import { open, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TextDecoder } from "node:util";
import { enterSkill, stageSkill, simulateSkill, renderSkill, renderRole, validateFast, validateFull, recordEvidence, readTrace } from "./api.mjs";
import { alignDecision } from "./alignment.mjs";
import { fail, normalizeError } from "./diagnostics.mjs";
import { assertExternalStateDir } from "./trace-core.mjs";
import { stableStringify } from "./hash.mjs";

const RECORD_DATA_MAX_BYTES = 64 * 1024;
const INPUT_FILE_CODES = new Set(["ENOENT", "EACCES", "EISDIR", "ENOTDIR", "ELOOP"]);

export async function main(argv = process.argv.slice(2), io = console) {
  let parsed = { _: [] };
  try {
    parsed = parseArgs(argv);
    const command = parsed._[0];
    validateCommandArgs(command, parsed);
    const skillRoot = resolve(parsed.skill ?? parsed._[1] ?? inferSkillRoot());
    const runtimeDir = resolve(parsed["runtime-dir"] ?? dirname(fileURLToPath(import.meta.url)));
    switch (command) {
      case "enter": {
        const value = await enterSkill({ skillRoot, runtimeDir, language: parsed.lang ?? "en" });
        emit(value, parsed.json, io, renderEnter);
        return 0;
      }
      case "stage": {
        const value = await stageSkill({ skillRoot, projectRoot: resolve(parsed.project ?? process.cwd()), targetPath: parsed.target, judged: pairs(parsed.judged), decided: pairs(parsed.decided), runtimeDir, language: parsed.lang ?? "en", traceDir: parsed["trace-dir"], runId: parsed["run-id"] });
        const resultPath = value.tracePath && value.runId ? join(dirname(value.tracePath), `${value.runId}.stage-result.json`) : null;
        const envelope = { schema: "skill-rails/stage-result/1", decision: value.decision, guide: value.guide, run_id: value.runId, trace_path: value.tracePath, result_path: resultPath };
        if (resultPath) await writeFile(resultPath, `${JSON.stringify(envelope, null, 2)}\n`, "utf8");
        emit(envelope, parsed.json, io, () => value.guide ?? JSON.stringify(value.decision, null, 2));
        if (value.runId && !parsed.json) io.error(`trace run: ${value.runId}`);
        return value.decision.status === "BLOCK" ? 2 : 0;
      }
      case "simulate": {
        const fixturePath = resolve(requiredValue(parsed.fixture ?? parsed._[2], "simulate requires --fixture or a fixture path.", "--fixture"));
        const fixture = await readJsonInput(fixturePath, fixturePath);
        const value = await simulateSkill({ skillRoot, fixture, runtimeDir, language: parsed.lang ?? "en", fullValidation: !parsed.fast });
        emit(value.decision, parsed.json, io, () => value.guide);
        return value.decision.status === "BLOCK" ? 2 : 0;
      }
      case "render": io.log(await renderSkill({ skillRoot, runtimeDir, language: parsed.lang ?? "en", stats: Boolean(parsed.stats) })); return 0;
      case "role": io.log(await renderRole({ skillRoot, roleId: parsed.role ?? parsed._[2], runtimeDir, language: parsed.lang ?? "en" })); return 0;
      case "lint": {
        const result = parsed.fast ? await validateFast(skillRoot) : await validateFull(skillRoot, { language: parsed.lang ?? "en" });
        emit(compactLint(result), parsed.json, io, renderLint);
        return result.ok ? 0 : 1;
      }
      case "record": {
        const decisionPath = resolve(requiredValue(parsed.decision, "record requires --decision <stage-result.json>.", "--decision"));
        const document = await readJsonInput(decisionPath, decisionPath);
        const decision = document.decision ?? document;
        const traceDir = parsed["trace-dir"] ?? (document.trace_path ? dirname(resolve(document.trace_path)) : null);
        const runId = parsed["run-id"] ?? document.run_id ?? null;
        if (!traceDir || !runId || !parsed.type) fail("SR_CLI_ARGUMENT", "record requires trace location, run id, and --type; a stage-result decision file may provide the first two.", { pointer: !traceDir ? "--trace-dir" : !runId ? "--run-id" : "--type", hint: "Use the saved stage-result file and one record type named by the current guide." });
        if (parsed.authority) fail("SR_EVIDENCE_AUTHORITY", "The agent-facing record command cannot assign evidence authority.");
        const data = await recordData(parsed, decision);
        validateRecordData(parsed.type, data);
        let artifactPath = null;
        let expectedArtifactPath = null;
        if (parsed.artifact) {
          if (parsed.type !== "artifact_verified") fail("SR_EVIDENCE_TYPE", "An artifact path may be recorded only as artifact_verified.");
          if (!parsed.project) fail("SR_EVIDENCE_PROJECT", "Artifact verification requires --project to resolve the declared artifact path.");
          const proof = decision.proof_required.find((item) => item.kind !== "effect" && item.reference === data.reference && item.path);
          if (!proof) fail("SR_EVIDENCE_PROOF", "The Decision has no matching artifact proof with a declared path.");
          artifactPath = resolve(parsed.artifact);
          expectedArtifactPath = resolve(parsed.project, proof.path);
        } else if (!["effect_claimed", "receipt_recorded", "proof_recorded"].includes(parsed.type)) {
          fail("SR_EVIDENCE_TYPE", "The agent-facing record command accepts only claims and receipts; observed effects require a trusted harness.");
        }
        await assertExternalStateDir(skillRoot, traceDir);
        const tracePath = join(resolve(traceDir), `${runId}.jsonl`);
        const events = await readTrace(tracePath);
        const emitted = events.find((event) => event.type === "decision_emitted" && event.authority === "runtime_observed" && event.decision_id === decision.decision_id && stableStringify(event.data?.decision) === stableStringify(decision));
        if (!emitted) fail("SR_EVIDENCE_DECISION", "Evidence may be attached only to the exact runtime-emitted Decision in this run.");
        const value = await recordEvidence({ skillRoot, traceDir, runId, decision, type: parsed.type, data, artifactPath, expectedArtifactPath });
        emit(value, parsed.json, io, JSON.stringify);
        return 0;
      }
      case "align": {
        const decisionPath = resolve(requiredValue(parsed.decision, "align requires --decision <stage-result.json>.", "--decision"));
        const document = await readJsonInput(decisionPath, decisionPath);
        const decision = document.decision ?? document;
        const tracePath = parsed.trace ?? document.trace_path;
        if (!tracePath) fail("SR_CLI_ARGUMENT", "align requires --trace or a stage-result decision file containing trace_path.", { pointer: "--trace", hint: "Use the complete saved stage-result file produced by stage." });
        await assertExternalStateDir(skillRoot, dirname(resolve(tracePath)));
        const events = await readTrace(resolve(tracePath));
        const report = alignDecision(decision, events);
        emit(report, true, io, JSON.stringify);
        return ["aligned", "partial", "unproven"].includes(report.aggregate) ? 0 : 2;
      }
      case "resume": {
        const tracePath = resolve(requiredValue(parsed.trace, "resume requires --trace <trace.jsonl>.", "--trace"));
        await assertExternalStateDir(skillRoot, dirname(tracePath));
        const events = await readTrace(tracePath);
        const lastEvent = [...events].reverse().find((event) => event.type === "decision_emitted");
        const last = lastEvent?.data?.decision;
        if (!last) fail("SR_TRACE_DECISION", "Trace contains no decision_emitted event.", { pointer: tracePath });
        const alignment = alignDecision(last, events);
        const runPath = join(runtimeDir, "run.mjs");
        const targetOption = typeof lastEvent.data?.targetPath === "string" ? ` --target ${commandArg(lastEvent.data.targetPath)}` : "";
        const reason = last.reinvoke ?? "terminal";
        const nextCommand = ["after-effects", "recompute"].includes(last.reinvoke)
          ? `node ${commandArg(runPath)} stage --skill ${commandArg(skillRoot)} --project ${commandArg(parsed.project ?? process.cwd())} --trace-dir ${commandArg(dirname(tracePath))} --run-id ${commandArg(lastEvent.run_id)}${targetOption} --json`
          : null;
        emit({ schema: "skill-rails/resume/2", last_decision: last, last_verified_decision: alignment.aggregate === "aligned" ? last : null, alignment, reason, next_command: nextCommand }, parsed.json, io, JSON.stringify);
        return 0;
      }
      default: fail("SR_CLI_ARGUMENT", `Unknown command: ${command ?? "<missing>"}`, { pointer: command ?? "<missing>", hint: "Use one runtime command listed in the generated skill guidance." });
    }
  } catch (error) {
    const diagnostic = normalizeError(error);
    io.error(parsed.json ? JSON.stringify({ ok: false, diagnostic }, null, 2) : `${diagnostic.code}: ${diagnostic.message}${diagnostic.pointer ? ` (${diagnostic.pointer})` : ""}`);
    if (parsed.debug && error.stack) io.error(error.stack);
    return error.exitCode ?? 1;
  }
}

function parseArgs(argv) {
  const result = { _: [] };
  const booleans = new Set(["json", "stats", "fast", "full", "debug"]);
  const repeated = new Set(["judged", "decided"]);
  const values = new Set(["skill", "runtime-dir", "lang", "project", "target", "trace-dir", "run-id", "fixture", "role", "decision", "type", "authority", "data", "data-file", "effect", "artifact", "trace"]);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      if (result._.length >= 3) argumentFailure(`Unexpected positional argument: ${arg}`, arg);
      result._.push(arg);
      continue;
    }
    const equal = arg.indexOf("=");
    const key = arg.slice(2, equal > 0 ? equal : undefined);
    if (!booleans.has(key) && !repeated.has(key) && !values.has(key)) argumentFailure(`Unknown option: --${key || "<empty>"}`, `--${key || "<empty>"}`);
    if (booleans.has(key)) {
      if (Object.hasOwn(result, key)) argumentFailure(`Duplicate option: --${key}`, `--${key}`);
      if (equal > 0) {
        const raw = arg.slice(equal + 1);
        if (raw !== "true" && raw !== "false") argumentFailure(`Boolean option --${key} accepts only true or false`, `--${key}`);
        result[key] = raw === "true";
      } else {
        if (["true", "false"].includes(argv[index + 1])) argumentFailure(`Boolean option --${key} uses --${key}=true or --${key}=false; a separate value is forbidden.`, `--${key}`);
        result[key] = true;
      }
      continue;
    }
    const value = equal > 0 ? arg.slice(equal + 1) : argv[++index];
    if (value === undefined || value.startsWith("--")) argumentFailure(`Missing value for --${key}`, `--${key}`);
    if (repeated.has(key)) (result[key] ??= []).push(value);
    else {
      if (Object.hasOwn(result, key)) argumentFailure(`Duplicate option: --${key}`, `--${key}`);
      result[key] = value;
    }
  }
  return result;
}

function pairs(values = []) {
  return Object.fromEntries(values.map((pair) => { const at = pair.indexOf("="); if (at < 1) argumentFailure(`Expected key=value: ${pair}`, pair); return [pair.slice(0, at), pair.slice(at + 1)]; }));
}

function validateCommandArgs(command, parsed) {
  const common = ["skill", "runtime-dir", "lang", "json", "debug"];
  const commands = {
    enter: { positions: 2, options: [] },
    stage: { positions: 2, options: ["project", "target", "judged", "decided", "trace-dir", "run-id"] },
    simulate: { positions: 3, options: ["fixture", "fast", "full"] },
    render: { positions: 2, options: ["stats"] },
    role: { positions: 3, options: ["role"] },
    lint: { positions: 2, options: ["fast", "full"] },
    record: { positions: 2, options: ["decision", "trace-dir", "run-id", "type", "authority", "data", "data-file", "effect", "artifact", "project"] },
    align: { positions: 2, options: ["decision", "trace"] },
    resume: { positions: 2, options: ["trace", "project"] }
  };
  const declaration = commands[command];
  if (!declaration) return;
  if (parsed._.length > declaration.positions) argumentFailure(`Unexpected positional argument for ${command}: ${parsed._[declaration.positions]}`, parsed._[declaration.positions]);
  const allowed = new Set([...common, ...declaration.options]);
  for (const key of Object.keys(parsed)) if (key !== "_" && !allowed.has(key)) argumentFailure(`Option --${key} is not valid for ${command}.`, `--${key}`);
}

async function recordData(parsed, decision) {
  const dataModes = ["data", "data-file"].filter((key) => Object.hasOwn(parsed, key));
  if (dataModes.length > 1) fail("SR_EVIDENCE_INPUT", "record accepts only one data source: --data-file or --data.", { pointer: dataModes.map((key) => `--${key}`).join(", "), hint: "Use --data-file for a shell-neutral UTF-8 JSON object." });
  let data = {};
  if (Object.hasOwn(parsed, "data-file")) {
    const path = resolve(parsed["data-file"]);
    data = await readJsonInput(path, path, { maxBytes: RECORD_DATA_MAX_BYTES });
  } else if (Object.hasOwn(parsed, "data")) data = parseJsonInput(parsed.data, "--data");
  if (Object.hasOwn(parsed, "effect")) {
    if (parsed.type !== "effect_claimed") fail("SR_EVIDENCE_TYPE", "--effect is valid only with --type effect_claimed.", { pointer: "--effect" });
    if (!/^(?:0|[1-9][0-9]*)$/.test(parsed.effect)) fail("SR_EVIDENCE_EFFECT", "--effect must be a non-negative integer Decision effect index.", { pointer: "--effect" });
    const index = Number(parsed.effect);
    const effect = decision.effects?.[index];
    if (!Number.isSafeInteger(index) || !Array.isArray(effect)) fail("SR_EVIDENCE_EFFECT", `Decision has no planned effect at index ${parsed.effect}.`, { pointer: "--effect", details: { available: (decision.effects ?? []).flatMap((item, effectIndex) => Array.isArray(item) ? [effectIndex] : []) } });
    if (!data || typeof data !== "object" || Array.isArray(data)) fail("SR_EVIDENCE_DATA", "Record data must be one JSON object.", { pointer: "record.data" });
    if ((Object.hasOwn(data, "index") && data.index !== index) || (Object.hasOwn(data, "verb") && data.verb !== effect[0])) fail("SR_EVIDENCE_EFFECT", "Record data conflicts with the selected Decision effect.", { pointer: "record.data", details: { expected: { index, verb: effect[0] } } });
    data = { ...data, index, verb: effect[0] };
  }
  return data;
}

function validateRecordData(type, data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) fail("SR_EVIDENCE_DATA", "Record data must be one JSON object.", { pointer: "record.data", hint: "Use --effect for a planned effect or put one JSON object in --data-file." });
  if (type === "artifact_verified" && !Object.hasOwn(data, "reference")) fail("SR_EVIDENCE_DATA", "artifact_verified data requires an explicit reference value.", { pointer: "record.data", details: { required: ["reference"] }, hint: "Copy reference from the matching artifact proof in the current Decision." });
}

async function readJsonInput(path, pointer, options = {}) {
  let bytes;
  try { bytes = options.maxBytes ? await readBounded(path, options.maxBytes) : await readFile(path); }
  catch (error) {
    if (INPUT_FILE_CODES.has(error?.code)) fail("SR_INPUT_FILE", `Cannot read input file: ${path}`, { pointer, hint: "Check that the path names a readable regular file.", cause: error });
    throw error;
  }
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch (error) { fail("SR_INPUT_ENCODING", "Input must be valid UTF-8.", { pointer, hint: "Save the file as UTF-8; a UTF-8 BOM is accepted.", cause: error }); }
  return parseJsonInput(text, pointer);
}

async function readBounded(path, maxBytes) {
  const initial = await stat(path);
  if (!initial.isFile()) fail("SR_INPUT_FILE", "Record data source must be a regular file.", { pointer: path, hint: "Use a bounded UTF-8 JSON file, not a directory, device, or pipe." });
  if (initial.size > maxBytes) fail("SR_INPUT_SIZE", `Record data file exceeds ${maxBytes} bytes.`, { pointer: path, details: { max_bytes: maxBytes } });
  const handle = await open(path, "r");
  try {
    const stats = await handle.stat();
    if (!stats.isFile()) fail("SR_INPUT_FILE", "Record data source must be a regular file.", { pointer: path, hint: "Use a bounded UTF-8 JSON file, not a directory, device, or pipe." });
    const buffer = Buffer.allocUnsafe(maxBytes + 1);
    let total = 0;
    while (total < buffer.length) {
      const { bytesRead } = await handle.read(buffer, total, buffer.length - total, total);
      if (bytesRead === 0) break;
      total += bytesRead;
    }
    if (total > maxBytes) fail("SR_INPUT_SIZE", `Record data file exceeds ${maxBytes} bytes.`, { pointer: path, details: { max_bytes: maxBytes } });
    return buffer.subarray(0, total);
  } finally { await handle.close(); }
}

function parseJsonInput(text, pointer) {
  try { return JSON.parse(text); }
  catch (error) { fail("SR_INPUT_JSON", "Input is not valid JSON.", { pointer, hint: pointer === "--data" ? "Use --effect for a planned effect or save the object as UTF-8 and pass --data-file." : "Fix the named JSON file and retry; no evidence was recorded.", cause: error }); }
}

function requiredValue(value, message, pointer) {
  if (value === undefined || value === null || value === "") fail("SR_CLI_ARGUMENT", message, { pointer, hint: "Use the generated skill's runtime command contract." });
  return value;
}

function argumentFailure(message, pointer) {
  fail("SR_CLI_ARGUMENT", message, { pointer, hint: "Use only the options documented for this generated runtime command." });
}

function emit(value, json, io, renderer) { io.log(json ? JSON.stringify(value, null, 2) : renderer(value)); }
function commandArg(value) { return `"${String(value).replaceAll('"', '\\"')}"`; }
function renderLint(result) { return result.ok ? `${result.level}: pass; L-full evidence is produced by build` : result.diagnostics.map((item) => `${item.code} ${item.pointer}: ${item.message}`).join("\n"); }
function compactLint(result) {
  return {
    ok: result.ok,
    level: result.level,
    diagnostics: result.diagnostics,
    checks: result.checks ?? null,
    spec: result.spec?.SPEC ?? null,
    analysis: result.analysis ? { exports: result.analysis.exports, imports: result.analysis.imports, predicateReads: result.analysis.predicateReads, callGraph: result.analysis.callGraph } : null
  };
}
function renderEnter(value) { return [`Skill Rails kernel/${value.kernel_version}`, `skill: ${value.skill}`, `enter-hash: ${value.enter_hash}`, ...value.sections.flatMap((section) => [`body: ${section.body} ${section.body_hash}`, section.markdown, "---", section.path ? `read-first path: ${section.path}\n${section.path_content}\n---` : ""])].filter(Boolean).join("\n"); }

function inferSkillRoot() {
  const runtimePath = dirname(fileURLToPath(import.meta.url));
  return resolve(runtimePath, "..", "..");
}
