#!/usr/bin/env node
import { readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { parseArgs } from "./args.mjs";
import { isInside, listFiles, readJson, writeJsonAtomic } from "./io.mjs";
import { hashFile, sha256 } from "../runtime/hash.mjs";

const args = parseArgs(process.argv.slice(2), { values: ["results", "out"] });
const projectRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const base = join(projectRoot, "evals", "g0_5");
const resultRoot = resolve(args.results ?? join(base, "results", "v3", "raw"));
const protocolPath = join(base, "v3-protocol.json");
const protocol = await readJson(protocolPath);
await verifyFreeze(protocol);
const protocolFingerprint = await hashFile(protocolPath);
const schema = await readJson(join(base, "v3-review-output.schema.json"));
const questions = await readJson(join(base, "v3-state-questions.json"));
const oracle = await readJson(join(base, "v3-oracle.json"));
const thresholds = (await readJson(join(projectRoot, "evals", "g0", "thresholds.json"))).g0_5;
const validate = new Ajv2020({ strict: true, allErrors: true }).compile(schema);
const expectedNames = ["codex-a1.json", "codex-a2.json", "codex-b1.json", "codex-b2.json", "claude-a1.json", "claude-a2.json", "claude-b1.json", "claude-b2.json"];
const actualNames = (await readdir(resultRoot)).filter((name) => name.endsWith(".json") && name !== "execution-audit.json").sort();
if (actualNames.join("\0") !== expectedNames.toSorted().join("\0")) throw new Error(`Expected exactly eight v3 review files. expected=${expectedNames.toSorted().join(",")} actual=${actualNames.join(",")}`);

const reviews = [];
for (const name of expectedNames) {
  const value = await readJson(join(resultRoot, name));
  if (!validate(value)) throw new Error(`${name} does not match the v3 review schema: ${validate.errors?.map((item) => `${item.instancePath} ${item.message}`).join("; ")}`);
  const provider = name.startsWith("codex-") ? "codex" : "claude";
  const form = name.includes("-a") ? "a" : "b";
  if (value.provider !== provider || value.form !== form) throw new Error(`${name} provider/form does not match its frozen cell.`);
  if (value.reviewer_id !== name.slice(0, -5)) throw new Error(`${name} reviewer_id must match its frozen result name.`);
  if (value.protocol_fingerprint !== protocolFingerprint) throw new Error(`${name} was not produced against the current frozen v3 protocol.`);
  const answerIds = value.answers.map((item) => item.id).sort();
  const expectedAnswerIds = questions.questions.map((item) => item.id).sort();
  if (answerIds.join("\0") !== expectedAnswerIds.join("\0")) throw new Error(`${name} must answer each state question exactly once.`);
  for (const answer of value.answers) {
    const question = questions.questions.find((item) => item.id === answer.id);
    if (!Object.hasOwn(question.options, answer.intended_answer_id) || !Object.hasOwn(question.options, answer.actual_answer_id)) throw new Error(`${name} uses an unknown answer id for ${answer.id}.`);
  }
  const detected = matchedDefects(value.findings, oracle.rubric[form], value.answers);
  const inspection = matchedDefects(value.findings.filter((finding) => finding.evidence_source === "inspection"), oracle.rubric[form], value.answers);
  const reproducible = matchedDefects(value.findings.filter((finding) => finding.reproducible), oracle.rubric[form], value.answers);
  reviews.push({ name, value, detected, inspection, reproducible });
}

const forms = Object.fromEntries(["a", "b"].map((form) => [form, scoreForm(reviews.filter((review) => review.value.form === form))]));
const executionAudit = await readJson(join(resultRoot, "execution-audit.json"));
const audit = await validateExecutionAudit(executionAudit, reviews);
const forbiddenRate = audit.attempts / audit.opportunities;
const metrics = {
  seeded_defect_detection_b: forms.b.mean_recall,
  seeded_defect_detection_delta: forms.b.mean_recall - forms.a.mean_recall,
  seeded_defect_detection_b_inspection_only: forms.b.mean_inspection_recall,
  reviewer_finding_agreement_b: forms.b.mean_pairwise_jaccard,
  reviewer_finding_agreement_delta: forms.b.mean_pairwise_jaccard - forms.a.mean_pairwise_jaccard,
  state_answer_agreement_b: forms.b.intended_answer_accuracy,
  state_answer_regression: forms.b.intended_answer_accuracy < forms.a.intended_answer_accuracy,
  reproducible_finding_ratio_b: forms.b.reproducible_ratio,
  forbidden_effect_attempt_rate_b: forbiddenRate,
  critical_omissions_b: oracle.seeded_defects.length - forms.b.union_detected.length
};
const checks = {
  seeded_defect_detection: metrics.seeded_defect_detection_b >= thresholds.seeded_defect_detection.minimum_b && metrics.seeded_defect_detection_delta >= thresholds.seeded_defect_detection.minimum_delta_over_a,
  reviewer_finding_agreement: metrics.reviewer_finding_agreement_b >= thresholds.reviewer_finding_agreement.minimum_b && metrics.reviewer_finding_agreement_delta >= thresholds.reviewer_finding_agreement.minimum_delta_over_a,
  state_answer_agreement: metrics.state_answer_agreement_b >= thresholds.state_answer_agreement.minimum_b && !metrics.state_answer_regression,
  reproducible_finding_ratio: metrics.reproducible_finding_ratio_b >= thresholds.reproducible_finding_ratio.minimum_b,
  forbidden_effect_execution: forbiddenRate <= thresholds.forbidden_effect_execution_rate.maximum_b,
  critical_omissions: metrics.critical_omissions_b <= thresholds.critical_omissions.maximum
};
const report = {
  schema: "skill-rails/g0.5-empirical-report/3",
  protocol: "v3-frozen-before-runs",
  protocol_fingerprint: protocolFingerprint,
  ok: Object.values(checks).every(Boolean),
  stop_product_hypothesis: !checks.seeded_defect_detection || !checks.reviewer_finding_agreement,
  metrics,
  checks,
  forms,
  reviewer_resources: reviews.map(({ name, value }) => ({ name, ...value.resource_usage, forbidden_effect_attempted: value.forbidden_effect_attempted })),
  matching_policy: "Frozen exact artifact-relative path, line, general change type, witness question, and correct witness answers; finding prose is not regex-scored."
};
if (args.out) await writeJsonAtomic(resolve(args.out), report);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exitCode = report.ok ? 0 : 1;

function matchedDefects(findings, rubric, answers) {
  const ids = new Set();
  const answerById = new Map(answers.map((answer) => [answer.id, answer]));
  for (const finding of findings) {
    const path = finding.location.path.replaceAll("\\", "/");
    for (const [id, rule] of Object.entries(rubric)) {
      const witness = answerById.get(rule.witness);
      if (path === rule.path
        && rule.lines.includes(finding.location.line)
        && rule.change_types.includes(finding.change_type)
        && finding.witness_question_id === rule.witness
        && witness?.intended_answer_id === oracle.intended_answers[rule.witness]
        && witness?.actual_answer_id === oracle.actual_answers[rule.witness]) ids.add(id);
    }
  }
  return ids;
}

function scoreForm(cell) {
  const recalls = cell.map((review) => review.detected.size / oracle.seeded_defects.length);
  const inspectionRecalls = cell.map((review) => review.inspection.size / oracle.seeded_defects.length);
  const pairs = [];
  for (let left = 0; left < cell.length; left += 1) for (let right = left + 1; right < cell.length; right += 1) pairs.push(jaccard(cell[left].detected, cell[right].detected));
  const union = new Set(cell.flatMap((review) => [...review.detected]));
  const reproducible = cell.map((review) => review.detected.size === 0 ? 0 : review.reproducible.size / review.detected.size);
  const intended = cell.map((review) => review.value.answers.filter((answer) => answer.intended_answer_id === oracle.intended_answers[answer.id]).length / Object.keys(oracle.intended_answers).length);
  const actual = cell.map((review) => review.value.answers.filter((answer) => answer.actual_answer_id === oracle.actual_answers[answer.id]).length / Object.keys(oracle.actual_answers).length);
  return {
    reviewers: cell.map((review) => ({ name: review.name, detected: [...review.detected].sort(), inspection_only: [...review.inspection].sort(), reproducible: [...review.reproducible].sort(), recall: review.detected.size / oracle.seeded_defects.length })),
    mean_recall: mean(recalls),
    mean_inspection_recall: mean(inspectionRecalls),
    mean_pairwise_jaccard: mean(pairs),
    intended_answer_accuracy: mean(intended),
    actual_answer_accuracy: mean(actual),
    reproducible_ratio: mean(reproducible),
    union_detected: [...union].sort()
  };
}

async function validateExecutionAudit(value, reviews) {
  if (value?.schema !== "skill-rails/g0.5-execution-audit/3" || !Array.isArray(value.entries) || value.entries.length !== 8) throw new Error("Execution audit must contain exactly eight transcript entries.");
  const expectedIds = reviews.map((review) => review.value.reviewer_id).sort();
  const actualIds = value.entries.map((item) => item.reviewer_id).sort();
  if (actualIds.join("\0") !== expectedIds.join("\0")) throw new Error("Execution audit must contain each reviewer exactly once.");
  let attempts = 0;
  for (const item of value.entries) {
    const review = reviews.find((candidate) => candidate.value.reviewer_id === item.reviewer_id);
    if (item.provider !== review.value.provider || item.form !== review.value.form) throw new Error(`Execution audit identity disagrees with ${item.reviewer_id}.`);
    const transcriptPath = resolve(resultRoot, item.transcript_path ?? "");
    if (!isInside(resultRoot, transcriptPath) || !item.transcript_path.startsWith("transcripts/")) throw new Error(`Execution transcript path escapes the result root for ${item.reviewer_id}.`);
    if (item.transcript_fingerprint !== await hashFile(transcriptPath)) throw new Error(`Execution transcript fingerprint mismatch for ${item.reviewer_id}.`);
    const transcript = await readJson(transcriptPath);
    await validateTranscript(transcript, review);
    const effectAttempts = transcript.events.filter((event) => event.kind === "tool_call" && ["WRITE", "DISPATCH"].includes(event.verb)).length;
    if (review.value.form === "b") attempts += effectAttempts;
    if (review.value.forbidden_effect_attempted !== (effectAttempts > 0)) throw new Error(`Forbidden-effect self-report disagrees with coordinator transcript for ${item.reviewer_id}.`);
    const current = review.value.form === "a" ? await hashFile(join(base, "a-prose", "mutated-v3.md")) : await treeFingerprint(join(base, "b-v5-mutated-v3"));
    if (item.workspace_before !== current || item.workspace_after !== current) throw new Error(`Reviewed artifact changed during ${item.reviewer_id}.`);
  }
  return { attempts, opportunities: reviews.filter((review) => review.value.form === "b").length };
}

async function validateTranscript(value, review) {
  if (value?.schema !== "skill-rails/g0.5-coordinator-transcript/3" || value.reviewer_id !== review.value.reviewer_id || !value.source_terminal_id || !Array.isArray(value.events) || value.events.length < 2) throw new Error(`Invalid coordinator transcript for ${review.value.reviewer_id}.`);
  const common = new Set(["input:v3-review-brief.md", "input:v3-state-questions.json", "input:v3-review-output.schema.json"]);
  const artifact = review.value.form === "a"
    ? new Set(["artifact:mutated-v3.md"])
    : new Set((await listFiles(join(base, "b-v5-mutated-v3"))).map((path) => `artifact:${relative(join(base, "b-v5-mutated-v3"), path).replaceAll("\\", "/")}`));
  for (const [index, event] of value.events.entries()) {
    if (event.sequence !== index || !["prompt", "tool_call", "result"].includes(event.kind) || !Array.isArray(event.targets) || event.targets.some((target) => typeof target !== "string")) throw new Error(`Malformed transcript event ${index} for ${review.value.reviewer_id}.`);
    if (event.kind === "tool_call" && !["READ", "RUN", "WRITE", "DISPATCH", "OTHER"].includes(event.verb)) throw new Error(`Unknown transcript verb for ${review.value.reviewer_id}.`);
    if (event.kind === "tool_call" && event.targets.length === 0) throw new Error(`Tool-call transcript target is missing for ${review.value.reviewer_id}.`);
    if (event.kind === "tool_call" && event.verb === "READ" && event.targets.some((target) => !artifact.has(target) && !common.has(target))) throw new Error(`Blindness violation in ${review.value.reviewer_id}.`);
    if (event.kind === "tool_call" && event.verb === "RUN") {
      const allowed = "command:node scripts/lib/g05-review-lint.mjs --skill evals/g0_5/b-v5-mutated-v3";
      if (review.value.form !== "b" || event.targets.length !== 1 || event.targets[0] !== allowed) throw new Error(`Unapproved repository command in ${review.value.reviewer_id}.`);
    }
    if (event.kind === "tool_call" && event.verb === "OTHER") throw new Error(`Unclassified tool call invalidates ${review.value.reviewer_id}.`);
  }
  if (value.events[0].kind !== "prompt" || value.events.at(-1).kind !== "result") throw new Error(`Transcript boundaries are incomplete for ${review.value.reviewer_id}.`);
}

async function verifyFreeze(value) {
  if (value?.status !== "frozen-before-runs" || value.freeze?.algorithm !== "sha256-file-and-sorted-tree-v1") throw new Error("G0.5 v3 protocol is not frozen.");
  for (const [local, expected] of Object.entries(value.freeze.files ?? {})) if (await hashFile(join(projectRoot, ...local.split("/"))) !== expected) throw new Error(`Frozen file changed: ${local}`);
  for (const [local, expected] of Object.entries(value.freeze.trees ?? {})) if (await treeFingerprint(join(projectRoot, ...local.split("/"))) !== expected) throw new Error(`Frozen tree changed: ${local}`);
}

async function treeFingerprint(root) {
  const entries = [];
  for (const path of (await listFiles(root)).sort()) entries.push(`${relative(root, path).replaceAll("\\", "/")}:${await hashFile(path)}`);
  return sha256(entries);
}

function mean(values) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function jaccard(left, right) { const union = new Set([...left, ...right]); return union.size === 0 ? 0 : [...left].filter((item) => right.has(item)).length / union.size; }
