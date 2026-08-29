import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { copyTree, readJson, writeJsonAtomic } from "../skills/skill-rails/scripts/lib/io.mjs";
import { materializeRuntime } from "../skills/skill-rails/scripts/lib/build-core.mjs";
import { validateFull } from "../skills/skill-rails/scripts/runtime/validator.mjs";
import { hashFile } from "../skills/skill-rails/scripts/runtime/hash.mjs";
import { ROOT, makeTestDir, removeTestDir } from "./helpers.mjs";

const G05 = join(ROOT, "evals", "g0_5");

test("G0.5 v3 clean control passes and each independent structured witness fails", async (t) => {
  const base = await makeTestDir("g05-preflight");
  t.after(() => removeTestDir(base));
  const cleanRoot = join(base, "clean");
  await copyTree(join(G05, "b-v5-clean"), cleanRoot);
  await materializeRuntime(cleanRoot);
  const clean = await validateFull(cleanRoot);
  assert.equal(clean.ok, true, JSON.stringify(clean.diagnostics));

  const mutated = runLint("b-v5-mutated-v3");
  assert.equal(mutated.status, 1);
  const report = JSON.parse(mutated.stdout);
  assert.equal(report.ok, false);
  const signatures = report.diagnostics.map((item) => `${item.code}:${item.pointer}`);
  assert.ok(signatures.includes("L5:TABLES.review.rows"));
  assert.ok(signatures.includes("L10:ARTIFACTS.reviewLog.readers"));
  assert.ok(signatures.includes("L14:fixtures/scenarios.json:review-open.expect.effects"));
  assert.ok(signatures.includes("L14:fixtures/scenarios.json:broken-record.expect.row"));
  assert.ok(signatures.includes("L14:fixtures/scenarios.json:unclassified"));
  assert.ok(signatures.includes("L15:fixtures/formats.json:review-result-golden.values"));
  const forbiddenControl = runLint("b-v5-clean");
  assert.equal(forbiddenControl.status, 1);
  assert.match(forbiddenControl.stderr, /only the frozen G0\.5 v3 B artifact/);
});

test("G0.5 v3 scorer uses frozen coordinates and complete forbidden-effect evidence", async (t) => {
  const base = await makeTestDir("g05-score");
  t.after(() => removeTestDir(base));
  const raw = join(base, "raw");
  const questions = await readJson(join(G05, "v3-state-questions.json"));
  const oracle = await readJson(join(G05, "v3-oracle.json"));
  const protocol = await readJson(join(G05, "v3-protocol.json"));
  const protocolFingerprint = await hashFile(join(G05, "v3-protocol.json"));
  const names = ["codex-a1", "codex-a2", "codex-b1", "codex-b2", "claude-a1", "claude-a2", "claude-b1", "claude-b2"];
  const auditEntries = [];
  for (const name of names) {
    const form = name.includes("-a") ? "a" : "b";
    const provider = name.startsWith("codex-") ? "codex" : "claude";
    const findings = form === "a" ? [] : Object.entries(oracle.rubric.b).map(([id, rule]) => ({
      location: { path: rule.path, line: rule.lines[0] },
      change_type: rule.change_types[0],
      witness_question_id: rule.witness,
      evidence_source: "lint-assisted",
      claim: `${id} frozen synthetic claim`,
      state: { witness: rule.witness },
      intended: "clean contract behavior",
      actual: "mutated behavior",
      reproducible: true
    }));
    await writeJsonAtomic(join(raw, `${name}.json`), {
      schema: "skill-rails/g0.5-review/3",
      protocol_fingerprint: protocolFingerprint,
      reviewer_id: name,
      provider,
      form,
      findings,
      answers: questions.questions.map(({ id }) => ({ id, intended_answer_id: oracle.intended_answers[id], actual_answer_id: oracle.actual_answers[id] })),
      forbidden_effect_attempted: false,
      resource_usage: { files_read: 1, repository_commands: form === "b" ? 1 : 0 },
      notes: "synthetic scorer contract test"
    });
    const transcriptPath = join(raw, "transcripts", `${name}.json`);
    await writeJsonAtomic(transcriptPath, {
      schema: "skill-rails/g0.5-coordinator-transcript/3",
      reviewer_id: name,
      source_terminal_id: `terminal:${name}`,
      events: [
        { sequence: 0, kind: "prompt", targets: [] },
        { sequence: 1, kind: "result", targets: [] }
      ]
    });
    const workspaceFingerprint = form === "a"
      ? protocol.freeze.files["evals/g0_5/a-prose/mutated-v3.md"]
      : protocol.freeze.trees["evals/g0_5/b-v5-mutated-v3"];
    auditEntries.push({
      reviewer_id: name,
      provider,
      form,
      transcript_path: `transcripts/${name}.json`,
      transcript_fingerprint: await hashFile(transcriptPath),
      workspace_before: workspaceFingerprint,
      workspace_after: workspaceFingerprint
    });
  }
  await writeJsonAtomic(join(raw, "execution-audit.json"), { schema: "skill-rails/g0.5-execution-audit/3", entries: auditEntries });
  const out = join(base, "report.json");
  const scored = spawnSync(process.execPath, [join(ROOT, "scripts", "lib", "g05-score-v3.mjs"), "--results", raw, "--out", out], { cwd: ROOT, encoding: "utf8", windowsHide: true });
  assert.equal(scored.status, 0, scored.stderr || scored.stdout);
  const report = await readJson(out);
  assert.equal(report.ok, true);
  assert.equal(report.metrics.seeded_defect_detection_b, 1);
  assert.equal(report.metrics.reviewer_finding_agreement_b, 1);
  assert.equal(report.metrics.seeded_defect_detection_b_inspection_only, 0);
  assert.equal(report.metrics.critical_omissions_b, 0);

  const valid = await readJson(join(raw, "codex-b1.json"));
  const invalid = structuredClone(valid);
  invalid.answers.find((answer) => answer.id === "q2").actual_answer_id = "outside-the-frozen-options";
  await writeJsonAtomic(join(raw, "codex-b1.json"), invalid);
  const rejected = spawnSync(process.execPath, [join(ROOT, "scripts", "lib", "g05-score-v3.mjs"), "--results", raw], { cwd: ROOT, encoding: "utf8", windowsHide: true });
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /unknown answer id/);

  await writeJsonAtomic(join(raw, "codex-b1.json"), valid);
  const transcriptPath = join(raw, "transcripts", "codex-b1.json");
  const transcript = await readJson(transcriptPath);
  transcript.events.splice(1, 0, { sequence: 1, kind: "tool_call", verb: "RUN", targets: ["command:git status"] });
  transcript.events[2].sequence = 2;
  await writeJsonAtomic(transcriptPath, transcript);
  const audit = await readJson(join(raw, "execution-audit.json"));
  audit.entries.find((item) => item.reviewer_id === "codex-b1").transcript_fingerprint = await hashFile(transcriptPath);
  await writeJsonAtomic(join(raw, "execution-audit.json"), audit);
  const commandRejected = spawnSync(process.execPath, [join(ROOT, "scripts", "lib", "g05-score-v3.mjs"), "--results", raw], { cwd: ROOT, encoding: "utf8", windowsHide: true });
  assert.equal(commandRejected.status, 1);
  assert.match(commandRejected.stderr, /Unapproved repository command/);
});

function runLint(name) {
  return spawnSync(process.execPath, [join(ROOT, "scripts", "lib", "g05-review-lint.mjs"), "--skill", join(G05, name)], { cwd: ROOT, encoding: "utf8", windowsHide: true });
}
