import { access, readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { validateFast, validateFull, importVerifiedSource } from "./validator.mjs";
import { computeFingerprints } from "./manifest.mjs";
import { loadBuiltSkill, reverifyBuiltSkill } from "./loader.mjs";
import { loadCollectorRegistry, collectObservations } from "./collectors.mjs";
import { bindObservationInputs, prepareFixtureInputs } from "./observations.mjs";
import { captureSnapshot, compareSnapshots } from "./snapshot.mjs";
import { evaluateSpec } from "./evaluator.mjs";
import { renderGuide } from "./guide.mjs";
import { loadBody, resolveBodySection } from "./body.mjs";
import { resolveTemplate } from "./templates.mjs";
import { appendTraceEvent, assertExternalStateDir, readTrace, recordEvidence } from "./trace-core.mjs";
import { acquireTraceRunLease } from "./trace-store.mjs";
import { alignDecision } from "./alignment.mjs";
import { DECISION_SCHEMA, KERNEL_VERSION, RUNTIME_VERSION, VALIDATOR_VERSION } from "./constants.mjs";
import { sha256, stableStringify } from "./hash.mjs";
import { fail } from "./diagnostics.mjs";
import { normalizeProjectTarget, resolveInside } from "./path-policy.mjs";

export async function loadAuthoringSkill(skillRoot, runtimeDir = null) {
  const root = resolve(skillRoot);
  const fast = await validateFast(root);
  if (!fast.ok) fail("SR_LFAST_FAILED", "L-fast rejected the spec before import.", { pointer: join(root, "spec.mjs"), details: fast.diagnostics });
  const spec = await importVerifiedSource(fast);
  const actualRuntimeDir = runtimeDir ?? await inferRuntimeDir(root);
  const fingerprints = await computeFingerprints(root, actualRuntimeDir);
  return { root, spec, fast, runtime: { version: RUNTIME_VERSION, ...fingerprints } };
}

export async function enterSkill({ skillRoot, runtimeDir = null, language = "en" }) {
  const loaded = await loadBuiltSkill(skillRoot, { runtimeDir: runtimeDir ?? await inferRuntimeDir(skillRoot) });
  const body = await loadBody(loaded.root, language);
  const sections = [];
  for (const item of loaded.spec.READ_FIRST ?? []) {
    const section = resolveBodySection(body, item.body, loaded.spec.SPEC.id);
    let referenced = null;
    if (item.path) {
      try { referenced = await readFile(await resolveInside(loaded.root, item.path, { code: "SR_READ_FIRST" }), "utf8"); }
      catch (error) { fail("SR_READ_FIRST", `READ_FIRST path cannot be read: ${item.path}`, { cause: error }); }
    }
    sections.push({ body: `${loaded.spec.SPEC.id}#${section.ref}`, body_hash: section.hash, markdown: section.markdown, path: item.path ?? null, path_content: referenced });
  }
  const enterHash = sha256({ kernel: KERNEL_VERSION, spec: loaded.runtime.spec_hash, content: loaded.runtime.content_hash, sections });
  await reverifyBuiltSkill(loaded);
  return { schema: "skill-rails/enter/1", skill: loaded.spec.SPEC.id, kernel_version: KERNEL_VERSION, enter_hash: enterHash, sections };
}

export async function stageSkill(options) {
  const normalized = { ...options };
  let release = null;
  if (normalized.traceDir) {
    await assertExternalStateDir(normalized.skillRoot, normalized.traceDir, normalized.projectRoot ?? null);
    normalized.runId ??= randomUUID();
    release = await acquireTraceRunLease(normalized.traceDir, normalized.runId);
  }
  try { return await stageSkillOnce(normalized); }
  finally { await release?.(); }
}

async function stageSkillOnce({ skillRoot, projectRoot, targetPath = null, judged = {}, decided = {}, runtimeDir = null, language = "en", traceDir = null, runId = null }) {
  const root = resolve(skillRoot);
  const targetProvided = targetPath !== null && targetPath !== undefined;
  let project = targetProvided ? resolve(projectRoot) : null;
  const targetContext = targetProvided ? { targetPath: await normalizeProjectTarget(project, targetPath) } : null;
  const loaded = await loadBuiltSkill(root, { runtimeDir: runtimeDir ?? await inferRuntimeDir(root) });
  let effectiveRunId = runId;
  if (traceDir) {
    await assertExternalStateDir(root, traceDir, projectRoot ?? null);
  }
  const tracePath = traceDir ? join(resolve(traceDir), `${effectiveRunId}.jsonl`) : null;
  if ((loaded.spec.DEFERRED ?? []).length > 0) {
    const decision = deferredDecision(loaded);
    await reverifyBuiltSkill(loaded);
    if (traceDir) {
      await appendTraceEvent(traceDir, { run_id: effectiveRunId, type: "spec_loaded", authority: "runtime_observed", spec_fingerprint: loaded.runtime.spec_hash, snapshot_fingerprint: decision.snapshot.fingerprint, data: { skill: loaded.spec.SPEC.id } });
      await appendTraceEvent(traceDir, { run_id: effectiveRunId, type: "review_required", authority: "runtime_observed", decision_id: decision.decision_id, spec_fingerprint: loaded.runtime.spec_hash, snapshot_fingerprint: decision.snapshot.fingerprint, data: { status: "BLOCK", reason: "deferred-authoring", deferred: loaded.spec.DEFERRED.map((item) => item.id) } });
      await appendTraceEvent(traceDir, { run_id: effectiveRunId, type: "decision_emitted", authority: "runtime_observed", decision_id: decision.decision_id, spec_fingerprint: loaded.runtime.spec_hash, snapshot_fingerprint: decision.snapshot.fingerprint, data: { status: decision.status, decision, ...(targetContext ?? {}) } });
    }
    return { decision, guide: "BLOCK: unresolved DEFERRED authoring items remain. Complete them and rebuild before runtime use.", runId: effectiveRunId, tracePath };
  }
  project ??= resolve(projectRoot);
  const registry = await loadCollectorRegistry(root);
  const start = await captureSnapshot(project, registry.snapshotBasis, targetContext);
  const parsedJudged = bindObservationInputs(loaded.spec, judged, "judged", start.fingerprint);
  const parsedDecided = bindObservationInputs(loaded.spec, decided, "decided", start.fingerprint);
  const collectorContext = { projectRoot: project, skillRoot: root, snapshot: start, ...(targetContext ?? {}) };
  const observations = await collectObservations(loaded.spec, registry, collectorContext, { ...parsedJudged, ...parsedDecided });
  const end = await captureSnapshot(project, registry.snapshotBasis, targetContext);
  const snapshot = compareSnapshots(start, end);
  if (traceDir) {
    // Trace storage may intentionally live under the project. Record only after
    // the end snapshot so the runtime's own evidence cannot make the domain stale.
    await appendTraceEvent(traceDir, { run_id: effectiveRunId, type: "spec_loaded", authority: "runtime_observed", spec_fingerprint: loaded.runtime.spec_hash, snapshot_fingerprint: start.fingerprint, data: { skill: loaded.spec.SPEC.id } });
    await appendTraceEvent(traceDir, { run_id: effectiveRunId, type: "snapshot_started", authority: "runtime_observed", spec_fingerprint: loaded.runtime.spec_hash, snapshot_fingerprint: start.fingerprint, data: { basis: start.material?.kind ?? "custom" } });
    for (const event of observationTraceEvents(loaded, observations, snapshot)) await appendTraceEvent(traceDir, { ...event, run_id: effectiveRunId });
  }
  if (snapshot.status === "stale") {
    const decision = staleDecision(loaded, snapshot, observations, parsedJudged, parsedDecided);
    await reverifyBuiltSkill(loaded);
    if (traceDir) {
      await appendTraceEvent(traceDir, { run_id: effectiveRunId, type: "snapshot_stale", authority: "runtime_observed", decision_id: decision.decision_id, spec_fingerprint: loaded.runtime.spec_hash, snapshot_fingerprint: snapshot.fingerprint, data: { start: snapshot.start_fingerprint, end: snapshot.end_fingerprint } });
      await appendTraceEvent(traceDir, { run_id: effectiveRunId, type: "decision_emitted", authority: "runtime_observed", decision_id: decision.decision_id, spec_fingerprint: loaded.runtime.spec_hash, snapshot_fingerprint: snapshot.fingerprint, data: { status: decision.status, decision, ...(targetContext ?? {}) } });
    }
    return { decision, guide: null, runId: effectiveRunId, tracePath };
  }
  const guardTrace = [];
  const decision = await evaluateSpec({ spec: loaded.spec, skillRoot: root, observations, snapshot, judged: parsedJudged, decided: parsedDecided, runtime: loaded.runtime, language, guardTrace });
  const enter = await enterSkill({ skillRoot: root, runtimeDir: runtimeDir ?? await inferRuntimeDir(root), language });
  const guide = renderGuide(decision, { enterHash: enter.enter_hash });
  await reverifyBuiltSkill(loaded);
  if (traceDir) {
    for (const event of decisionTraceEvents(decision, guide, guardTrace, targetContext)) await appendTraceEvent(traceDir, { ...event, run_id: effectiveRunId });
  }
  return { decision, guide, runId: effectiveRunId, tracePath };
}

export async function simulateSkill({ skillRoot, fixture, runtimeDir = null, language = "en", fullValidation = false, predicateTimings = null, evaluationObserver = null }) {
  const root = resolve(skillRoot);
  const loaded = await loadAuthoringSkill(root, runtimeDir ?? await inferRuntimeDir(root));
  if (fullValidation) {
    const validation = await validateFull(root, { language });
    if (!validation.ok) fail("SR_LFULL_FAILED", "L-full rejected the package.", { details: validation.diagnostics });
  }
  const { observations, snapshot, judged, decided } = prepareFixtureInputs(loaded.spec, fixture);
  const decision = await evaluateSpec({ spec: loaded.spec, skillRoot: root, observations, snapshot, judged, decided, runtime: loaded.runtime, language, predicateTimings, evaluationObserver });
  return { decision, guide: renderGuide(decision) };
}

export async function renderSkill({ skillRoot, runtimeDir = null, language = "en", stats = false }) {
  const loaded = await loadAuthoringSkill(skillRoot, runtimeDir ?? await inferRuntimeDir(skillRoot));
  const body = await loadBody(loaded.root, language);
  const lines = [`# ${loaded.spec.SPEC.id} — rendered contract`, "", `Spec fingerprint: ${loaded.runtime.spec_hash}`, "", "## Guards", ""];
  for (const guard of loaded.spec.GUARDS ?? []) lines.push(`- \`${guard.id}\`: reads ${guard.reads.join(", ") || "none"}; then ${guard.then}; body ${guard.body}`);
  lines.push("", "## Stages", "");
  for (const stage of loaded.spec.STAGES ?? []) lines.push(`- \`${stage.id}\`: reads ${stage.reads.join(", ") || "none"}; ${stage.record ? `record ${stableStringify(stage.record)}` : `reentry ${stage.reentry}`}; body ${stage.body}`);
  lines.push("", "```mermaid", "stateDiagram-v2", "    [*] --> " + (loaded.spec.STAGES?.[0]?.id ?? "DONE"));
  for (let index = 0; index < (loaded.spec.STAGES ?? []).length; index += 1) lines.push(`    ${loaded.spec.STAGES[index].id} --> ${loaded.spec.STAGES[index + 1]?.id ?? "DONE"}`);
  lines.push("```", "", "## Tables", "");
  for (const [id, table] of Object.entries(loaded.spec.TABLES ?? {})) lines.push(`- \`${id}\`: ${table.rows.map((row) => row.state).join(" → ")}`);
  lines.push("", "## Formats", "");
  for (const [id, format] of Object.entries(loaded.spec.FORMATS ?? {})) lines.push(`- \`${id}\`: ${format.head}; fields ${Object.keys(format.fields).join(", ") || "none"}`);
  lines.push("", "## Templates", "");
  for (const [id, declaration] of Object.entries(loaded.spec.TEMPLATES ?? {})) lines.push(`- \`${id}\`: ${declaration.file ?? `inline:${declaration.inline}`}`);
  lines.push("", "## Body sections", "");
  for (const section of body.sections) lines.push(`- \`${section.ref}\` ${section.hash}`);
  lines.push("", "## Not enforced (DEFERRED)", "");
  for (const item of loaded.spec.DEFERRED ?? []) lines.push(`- \`${item.id}\`: ${item.rule} (owner ${item.owner}; until ${item.until})`);
  if ((loaded.spec.DEFERRED ?? []).length === 0) lines.push("- none");
  if (stats) lines.push("", "## Stats", "", `- guards: ${(loaded.spec.GUARDS ?? []).length}`, `- stages: ${(loaded.spec.STAGES ?? []).length}`, `- rows: ${Object.values(loaded.spec.TABLES ?? {}).reduce((sum, table) => sum + table.rows.length, 0)}`, `- judgment points: ${Object.values(loaded.spec.OBSERVATIONS ?? {}).filter((item) => item.judged).length}`, `- deferred: ${(loaded.spec.DEFERRED ?? []).length}`);
  return lines.join("\n") + "\n";
}

export async function renderRole({ skillRoot, roleId, runtimeDir = null, language = "en" }) {
  const loaded = await loadAuthoringSkill(skillRoot, runtimeDir ?? await inferRuntimeDir(skillRoot));
  const role = loaded.spec.ROLES?.[roleId];
  if (!role) fail("SR_ROLE", `Role does not exist: ${roleId}`);
  const body = await loadBody(loaded.root, language);
  const section = resolveBodySection(body, role.body, loaded.spec.SPEC.id);
  let returns = null;
  if (role.returns && loaded.spec.TEMPLATES?.[role.returns]) returns = await resolveTemplate(loaded.root, role.returns, loaded.spec.TEMPLATES[role.returns], body.markdown);
  return [
    `role: ${roleId}`,
    `inputs: ${stableStringify(role.inputs ?? [])}`,
    `reads: ${stableStringify(role.reads ?? [])}`,
    `effects: ${stableStringify(role.effects ?? [])}`,
    `judgments: ${stableStringify(role.judgments ?? {})}`,
    section.markdown,
    returns ? `returns:\n${returns.trimEnd()}\n---` : "returns: none"
  ].join("\n");
}

export async function alignRun({ decision, tracePath }) {
  return alignDecision(decision, await readTrace(tracePath));
}

export { validateFast, validateFull, recordEvidence, readTrace };

async function pathExists(path) {
  try { await access(path, fsConstants.R_OK); return true; }
  catch { return false; }
}

async function inferRuntimeDir(skillRoot) {
  const root = resolve(skillRoot);
  const embedded = join(root, "scripts", "skill-rails");
  if (await pathExists(join(embedded, "dsl.mjs"))) return embedded;
  const authoring = join(root, "scripts", "runtime");
  if (await pathExists(join(authoring, "dsl.mjs"))) return authoring;
  return embedded;
}

function staleDecision(loaded, snapshot, observations, judged, decided) {
  const value = {
    schema: DECISION_SCHEMA, decision_id: null, skill: loaded.spec.SPEC.id,
    spec: { id: loaded.spec.SPEC.id, version: "5", fingerprint: loaded.runtime.spec_hash },
    runtime: { version: loaded.runtime.version, hash: loaded.runtime.runtime_hash, dsl_hash: loaded.runtime.dsl_hash, validator_version: loaded.runtime.validator_version, validator_hash: loaded.runtime.validator_hash, minimum_node_major: loaded.runtime.minimum_node_major },
    snapshot: { fingerprint: snapshot.fingerprint, status: "stale", unknowns: observations.unknowns }, status: "BLOCK", guard: { id: "snapshot-stale", then: "BLOCK", reason: "observation-changed" }, bypassed: [], restrict: [], stage: null, row: null, facts: [], judged, decided, record: null, reads: [], effects: [], format: null, template: null, template_text: null, body: null, stage_artifacts: [], needs: [], proof_required: [], reinvoke: "recompute", assurance: "checked"
  };
  value.decision_id = sha256({ ...value, decision_id: undefined });
  return value;
}

function deferredDecision(loaded) {
  const fingerprint = sha256({ spec: loaded.runtime.spec_hash, deferred: loaded.spec.DEFERRED.map((item) => item.id) });
  const value = {
    schema: DECISION_SCHEMA, decision_id: null, skill: loaded.spec.SPEC.id,
    spec: { id: loaded.spec.SPEC.id, version: "5", fingerprint: loaded.runtime.spec_hash },
    runtime: { version: loaded.runtime.version, hash: loaded.runtime.runtime_hash, dsl_hash: loaded.runtime.dsl_hash, validator_version: loaded.runtime.validator_version, validator_hash: loaded.runtime.validator_hash, minimum_node_major: loaded.runtime.minimum_node_major },
    snapshot: { fingerprint, status: "stable", unknowns: [] }, status: "BLOCK", guard: { id: "authoring-deferred", then: "BLOCK", reason: "unresolved-deferred" }, bypassed: [], restrict: [], stage: null, row: null, facts: [], judged: {}, decided: {}, record: null, reads: [], effects: [], format: null, template: null, template_text: null, body: null, stage_artifacts: [], needs: [], proof_required: [], reinvoke: "after-authoring", assurance: "checked"
  };
  value.decision_id = sha256({ ...value, decision_id: undefined });
  return value;
}

function observationTraceEvents(loaded, observations, snapshot) {
  const base = { authority: "runtime_observed", decision_id: null, spec_fingerprint: loaded.runtime.spec_hash, snapshot_fingerprint: snapshot.fingerprint };
  const events = Object.entries(observations.flat).map(([field, value]) => ({ ...base, type: value?.__skillRailsUnknown === true ? "observation_unknown" : "observation_collected", data: { field, unknown: value?.__skillRailsUnknown === true } }));
  if (snapshot.status === "stable") events.push({ ...base, type: "snapshot_stable", data: { start: snapshot.start_fingerprint, end: snapshot.end_fingerprint } });
  return events;
}

function decisionTraceEvents(decision, guide, guardTrace, targetContext) {
  const base = { authority: "runtime_observed", decision_id: decision.decision_id, spec_fingerprint: decision.spec.fingerprint, snapshot_fingerprint: decision.snapshot.fingerprint };
  const events = guardTrace.map((event) => ({ ...base, ...event }));
  if (decision.stage) events.push({ ...base, type: "stage_entered", data: { stage: decision.stage, row: decision.row } });
  for (const [index, effect] of decision.effects.entries()) if (Array.isArray(effect)) events.push({ ...base, type: "effect_planned", data: { index, verb: effect[0], args: effect[1] } });
  if (["ASK", "WAIT", "BLOCK"].includes(decision.status)) events.push({ ...base, type: "review_required", data: { status: decision.status, needs: decision.needs } });
  events.push({ ...base, type: "decision_emitted", data: { status: decision.status, stage: decision.stage, row: decision.row, decision, ...(targetContext ?? {}) } });
  events.push({ ...base, type: "guide_rendered", data: { guide_hash: sha256(guide) } });
  return events;
}
