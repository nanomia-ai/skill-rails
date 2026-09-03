import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { enterSkill, stageSkill, simulateSkill, renderSkill, renderRole, validateFast, validateFull, recordEvidence, readTrace } from "./api.mjs";
import { alignDecision } from "./alignment.mjs";
import { fail, normalizeError } from "./diagnostics.mjs";
import { assertExternalStateDir } from "./trace-core.mjs";
import { stableStringify } from "./hash.mjs";

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
        const envelope = { schema: "skill-rails/stage-result/1", decision: value.decision, guide: value.guide, run_id: value.runId, trace_path: value.tracePath };
        emit(envelope, parsed.json, io, () => value.guide ?? JSON.stringify(value.decision, null, 2));
        if (value.runId && !parsed.json) io.error(`trace run: ${value.runId}`);
        return value.decision.status === "BLOCK" ? 2 : 0;
      }
      case "simulate": {
        const fixturePath = resolve(parsed.fixture ?? parsed._[2]);
        const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
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
        const document = JSON.parse(await readFile(resolve(parsed.decision), "utf8"));
        const decision = document.decision ?? document;
        const traceDir = parsed["trace-dir"] ?? (document.trace_path ? dirname(resolve(document.trace_path)) : null);
        const runId = parsed["run-id"] ?? document.run_id ?? null;
        if (!traceDir || !runId || !parsed.type) throw new Error("record requires trace location, run id, and --type; a stage-result decision file may provide the first two.");
        if (parsed.authority) fail("SR_EVIDENCE_AUTHORITY", "The agent-facing record command cannot assign evidence authority.");
        await assertExternalStateDir(skillRoot, traceDir, parsed.project ? resolve(parsed.project) : null);
        const tracePath = join(resolve(traceDir), `${runId}.jsonl`);
        const events = await readTrace(tracePath);
        const emitted = events.find((event) => event.type === "decision_emitted" && event.authority === "runtime_observed" && event.decision_id === decision.decision_id && stableStringify(event.data?.decision) === stableStringify(decision));
        if (!emitted) fail("SR_EVIDENCE_DECISION", "Evidence may be attached only to the exact runtime-emitted Decision in this run.");
        const data = parsed.data ? JSON.parse(parsed.data) : {};
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
        const value = await recordEvidence({ skillRoot, traceDir, runId, decision, type: parsed.type, data, artifactPath, expectedArtifactPath, projectRoot: parsed.project ? resolve(parsed.project) : null });
        emit(value, parsed.json, io, JSON.stringify);
        return 0;
      }
      case "align": {
        const document = JSON.parse(await readFile(resolve(parsed.decision), "utf8"));
        const decision = document.decision ?? document;
        const tracePath = parsed.trace ?? document.trace_path;
        if (!tracePath) throw new Error("align requires --trace or a stage-result decision file containing trace_path.");
        await assertExternalStateDir(skillRoot, dirname(resolve(tracePath)), parsed.project ? resolve(parsed.project) : null);
        const events = await readTrace(resolve(tracePath));
        const report = alignDecision(decision, events);
        emit(report, true, io, JSON.stringify);
        return ["aligned", "partial", "unproven"].includes(report.aggregate) ? 0 : 2;
      }
      case "resume": {
        const tracePath = resolve(parsed.trace);
        await assertExternalStateDir(skillRoot, dirname(tracePath), parsed.project ? resolve(parsed.project) : null);
        const events = await readTrace(tracePath);
        const lastEvent = [...events].reverse().find((event) => event.type === "decision_emitted");
        const last = lastEvent?.data?.decision;
        if (!last) throw new Error("Trace contains no decision_emitted event.");
        const alignment = alignDecision(last, events);
        const runPath = join(runtimeDir, "run.mjs");
        const targetOption = typeof lastEvent.data?.targetPath === "string" ? ` --target ${commandArg(lastEvent.data.targetPath)}` : "";
        emit({ schema: "skill-rails/resume/1", last_decision: last, last_verified_decision: alignment.aggregate === "aligned" ? last : null, alignment, next_command: `node ${commandArg(runPath)} stage --skill ${commandArg(skillRoot)} --project ${commandArg(parsed.project ?? process.cwd())} --trace-dir ${commandArg(dirname(tracePath))} --run-id ${commandArg(lastEvent.run_id)}${targetOption}` }, parsed.json, io, JSON.stringify);
        return 0;
      }
      default: throw new Error(`Unknown command: ${command ?? "<missing>"}`);
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
  const values = new Set(["skill", "runtime-dir", "lang", "project", "target", "trace-dir", "run-id", "fixture", "role", "decision", "type", "authority", "data", "artifact", "trace"]);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      if (result._.length >= 3) throw new Error(`Unexpected positional argument: ${arg}`);
      result._.push(arg);
      continue;
    }
    const equal = arg.indexOf("=");
    const key = arg.slice(2, equal > 0 ? equal : undefined);
    if (!booleans.has(key) && !repeated.has(key) && !values.has(key)) throw new Error(`Unknown option: --${key || "<empty>"}`);
    if (booleans.has(key)) {
      if (Object.hasOwn(result, key)) throw new Error(`Duplicate option: --${key}`);
      if (equal > 0) {
        const raw = arg.slice(equal + 1);
        if (raw !== "true" && raw !== "false") throw new Error(`Boolean option --${key} accepts only true or false`);
        result[key] = raw === "true";
      } else {
        if (["true", "false"].includes(argv[index + 1])) throw new Error(`Boolean option --${key} uses --${key}=true or --${key}=false; a separate value is forbidden.`);
        result[key] = true;
      }
      continue;
    }
    const value = equal > 0 ? arg.slice(equal + 1) : argv[++index];
    if (value === undefined || value.startsWith("--")) throw new Error(`Missing value for --${key}`);
    if (repeated.has(key)) (result[key] ??= []).push(value);
    else {
      if (Object.hasOwn(result, key)) throw new Error(`Duplicate option: --${key}`);
      result[key] = value;
    }
  }
  return result;
}

function pairs(values = []) {
  return Object.fromEntries(values.map((pair) => { const at = pair.indexOf("="); if (at < 1) throw new Error(`Expected key=value: ${pair}`); return [pair.slice(0, at), pair.slice(at + 1)]; }));
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
    record: { positions: 2, options: ["decision", "trace-dir", "run-id", "type", "authority", "data", "artifact", "project"] },
    align: { positions: 2, options: ["decision", "trace", "project"] },
    resume: { positions: 2, options: ["trace", "project"] }
  };
  const declaration = commands[command];
  if (!declaration) return;
  if (parsed._.length > declaration.positions) throw new Error(`Unexpected positional argument for ${command}: ${parsed._[declaration.positions]}`);
  const allowed = new Set([...common, ...declaration.options]);
  for (const key of Object.keys(parsed)) if (key !== "_" && !allowed.has(key)) throw new Error(`Option --${key} is not valid for ${command}.`);
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
