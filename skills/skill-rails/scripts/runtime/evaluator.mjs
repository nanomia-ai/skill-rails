import { DECISION_SCHEMA, RUNTIME_VERSION, VALIDATOR_VERSION } from "./constants.mjs";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { join } from "node:path";
import { isUnknown } from "./dsl.mjs";
import { validateDomainValue } from "./domains.mjs";
import { sha256 } from "./hash.mjs";
import { loadBody, resolveBodySection } from "./body.mjs";
import { resolveTemplate } from "./templates.mjs";
import { fail } from "./diagnostics.mjs";

export async function evaluateSpec({ spec, skillRoot, observations, snapshot, judged = {}, decided = {}, runtime, language = "en", predicateTimings = null, guardTrace = null, evaluationObserver = null }) {
  const facts = new Map();
  const bypassed = [];
  const restrictions = new Map();
  const s = observations.nested;
  let stoppingGuard = null;

  for (const guard of spec.GUARDS ?? []) {
    const checked = checkReads(spec, guard, observations.flat, facts);
    if (!checked.ok) return finalize(await decisionParts({ spec, skillRoot, snapshot, runtime, observations, judged, decided, facts, bypassed, restrictions, status: "BLOCK", guard: { id: guard.id, then: "BLOCK", reason: checked.reason }, stage: null, row: null, effects: [], bodyRef: guard.body, needs: checked.needs, language }));
    const evaluatedEvent = { type: "guard_evaluated", data: { guard: guard.id } };
    guardTrace?.push(evaluatedEvent);
    evaluationObserver?.(evaluatedEvent);
    let matched = callPredicate(guard.when, s, `GUARDS.${guard.id}.when`, predicateTimings);
    if (!matched) continue;
    if (guard.unless) {
      const unlessReads = checkReads(spec, guard.unless, observations.flat, facts);
      if (!unlessReads.ok) {
        const matchedEvent = { type: "guard_matched", data: { guard: guard.id, pending_unless: guard.unless.id } };
        guardTrace?.push(matchedEvent);
        evaluationObserver?.(matchedEvent);
        return finalize(await decisionParts({ spec, skillRoot, snapshot, runtime, observations, judged, decided, facts, bypassed, restrictions, status: "BLOCK", guard: { id: guard.id, then: "BLOCK", reason: unlessReads.reason }, stage: null, row: null, effects: [], bodyRef: guard.body, needs: unlessReads.needs, language }));
      }
      if (callPredicate(guard.unless.when, s, `GUARDS.${guard.id}.unless.when`, predicateTimings)) {
        bypassed.push({ guard: guard.id, by: guard.unless.id });
        const bypassedEvent = { type: "guard_matched", data: { guard: guard.id, bypassed_by: guard.unless.id } };
        guardTrace?.push(bypassedEvent);
        evaluationObserver?.(bypassedEvent);
        continue;
      }
    }
    const matchedEvent = { type: "guard_matched", data: { guard: guard.id, then: guard.then } };
    guardTrace?.push(matchedEvent);
    evaluationObserver?.(matchedEvent);
    if (guard.then === "RESTRICT") {
      for (const verb of guard.forbids ?? []) if (!restrictions.has(verb)) restrictions.set(verb, guard.id);
      continue;
    }
    stoppingGuard = { id: guard.id, then: guard.then };
    const status = terminalStatus(guard.then);
    return finalize(await decisionParts({ spec, skillRoot, snapshot, runtime, observations, judged, decided, facts, bypassed, restrictions, status, guard: stoppingGuard, stage: null, row: null, effects: [], bodyRef: guard.body, needs: [], language }));
  }

  let selectedStage = null;
  let selectedRow = null;
  let selectedPlan = null;
  let selectedNeeds = [];
  for (const stage of spec.STAGES ?? []) {
    let row = null;
    let plan = null;
    let pendingNeeds = [];
    const checked = checkReads(spec, stage, observations.flat, facts, stage.needs ?? []);
    if (!checked.ok) {
      evaluationObserver?.({ type: "stage_entered", data: { stage: stage.id } });
      return finalize(await decisionParts({ spec, skillRoot, snapshot, runtime, observations, judged, decided, facts, bypassed, restrictions, status: "BLOCK", guard: stoppingGuard, stage: stage.id, row: null, effects: [], bodyRef: stage.body, needs: checked.needs, language, record: stage.record ?? { reentry: stage.reentry } }));
    }
    if (callPredicate(stage.done, s, `STAGES.${stage.id}.done`, predicateTimings)) continue;
    evaluationObserver?.({ type: "stage_entered", data: { stage: stage.id } });
    if (stage.needs?.length) {
      pendingNeeds = stage.needs.filter((field) => isUnknown(observations.flat[field])).map((field) => needDescriptor(spec, field, stage.body));
      if (pendingNeeds.length > 0) return finalize(await decisionParts({ spec, skillRoot, snapshot, runtime, observations, judged, decided, facts, bypassed, restrictions, status: "BLOCK", guard: stoppingGuard, stage: stage.id, row: null, effects: [], bodyRef: stage.body, needs: pendingNeeds, language, record: stage.record ?? { reentry: stage.reentry } }));
      row = String(observations.flat[stage.needs[0]]);
      plan = stage.branches?.[row];
      evaluationObserver?.({ type: "branch_selected", data: { stage: stage.id, row } });
      if (isNoEffectNext(plan)) continue;
    }
    selectedStage = stage;
    if (stage.table) {
      const table = spec.TABLES[stage.table];
      const matches = [];
      const candidates = table.exclusive ? table.rows.slice(0, -1) : table.rows;
      for (const candidate of candidates) {
        const rowReads = checkReads(spec, candidate, observations.flat, facts);
        if (!rowReads.ok) return finalize(await decisionParts({ spec, skillRoot, snapshot, runtime, observations, judged, decided, facts, bypassed, restrictions, status: "BLOCK", guard: stoppingGuard, stage: stage.id, row: candidate.state, effects: [], bodyRef: stage.body, needs: rowReads.needs, language, record: stage.record ?? { reentry: stage.reentry } }));
        if (callPredicate(candidate.when, s, `TABLES.${stage.table}.${candidate.state}.when`, predicateTimings)) {
          matches.push(candidate.state);
          if (!table.exclusive) break;
        }
      }
      if (table.exclusive && matches.length > 1) fail("L5", `Exclusive table ${stage.table} matched multiple rows: ${matches.join(", ")}`);
      if (table.exclusive && matches.length === 0) matches.push(table.rows.at(-1).state);
      row = matches[0] ?? null;
      if (!row) fail("L5", `Table ${stage.table} produced no row.`);
      plan = stage.branches[row];
      evaluationObserver?.({ type: "table_row_selected", data: { table: stage.table, row } });
    } else if (!plan) plan = stage.effects;
    selectedRow = row;
    selectedPlan = plan;
    selectedNeeds = pendingNeeds;
    break;
  }

  if (!selectedStage) return finalize(await decisionParts({ spec, skillRoot, snapshot, runtime, observations, judged, decided, facts, bypassed, restrictions, status: "DONE", guard: stoppingGuard, stage: null, row: null, effects: [], bodyRef: null, needs: [], language }));
  if (!Array.isArray(selectedPlan)) fail("L6", `No effect plan for stage ${selectedStage.id}${selectedRow ? ` row ${selectedRow}` : ""}.`);

  if (selectedRow?.startsWith("BLOCK:")) return finalize(await decisionParts({ spec, skillRoot, snapshot, runtime, observations, judged, decided, facts, bypassed, restrictions, status: "BLOCK", guard: stoppingGuard, stage: selectedStage.id, row: selectedRow, effects: [], bodyRef: selectedStage.body, needs: [], language, record: selectedStage.record ?? { reentry: selectedStage.reentry } }));

  const verbs = selectedPlan.filter(Array.isArray).map((effect) => effect[0]);
  const conflict = verbs.find((verb) => restrictions.has(verb));
  if (conflict) return finalize(await decisionParts({ spec, skillRoot, snapshot, runtime, observations, judged, decided, facts, bypassed, restrictions, status: "BLOCK", guard: { id: restrictions.get(conflict), then: "RESTRICT", reason: `restricted-effect ${conflict}` }, stage: selectedStage.id, row: selectedRow, effects: [], bodyRef: selectedStage.body, needs: [], language, record: selectedStage.record ?? { reentry: selectedStage.reentry } }));

  const terminal = selectedPlan.at(-1);
  const status = terminalStatus(terminal);
  return finalize(await decisionParts({ spec, skillRoot, snapshot, runtime, observations, judged, decided, facts, bypassed, restrictions, status, guard: stoppingGuard, stage: selectedStage.id, row: selectedRow, effects: selectedPlan, bodyRef: selectedStage.body, needs: selectedNeeds, language, record: selectedStage.record ?? { reentry: selectedStage.reentry } }));
}

async function decisionParts(context) {
  const { spec, skillRoot, snapshot, runtime, observations, judged, decided, facts, bypassed, restrictions, status, guard, stage, row, effects, bodyRef, needs, language, record = null } = context;
  const bodyDocument = bodyRef ? await loadBody(skillRoot, language) : null;
  const bodySection = bodyRef ? resolveBodySection(bodyDocument, bodyRef, spec.SPEC.id) : null;
  const projection = await resolveProjection(spec, skillRoot, effects, record, bodyDocument?.markdown ?? "");
  const proofRequired = proofFor(spec, record, effects);
  return {
    schema: DECISION_SCHEMA,
    decision_id: null,
    skill: spec.SPEC.id,
    spec: { id: spec.SPEC.id, version: spec.SPEC.version, fingerprint: runtime.spec_hash },
    runtime: {
      version: runtime.version ?? RUNTIME_VERSION,
      hash: runtime.runtime_hash,
      dsl_hash: runtime.dsl_hash,
      validator_version: runtime.validator_version ?? VALIDATOR_VERSION,
      validator_hash: runtime.validator_hash,
      minimum_node_major: runtime.minimum_node_major
    },
    snapshot: { fingerprint: snapshot.fingerprint, status: snapshot.status ?? "stable", unknowns: observations.unknowns ?? [] },
    status,
    guard,
    bypassed,
    restrict: [...restrictions.keys()].sort(),
    stage,
    row,
    facts: [...facts.entries()].map(([field, value]) => ({ field, value: serializable(value) })),
    judged: serializable(judged),
    decided: serializable(decided),
    record,
    reads: [...facts.keys()].sort(),
    effects: serializable(projection.effects),
    format: projection.format,
    template: projection.template,
    template_text: projection.templateText,
    body: bodySection ? { ref: `${spec.SPEC.id}#${bodySection.ref}`, hash: bodySection.hash, markdown: bodySection.markdown } : null,
    stage_artifacts: projectStageArtifacts(spec, stage, guard),
    needs,
    proof_required: proofRequired,
    reinvoke: projection.effects.at?.(-1) === "NEXT" ? "after-effects" : null,
    assurance: "checked"
  };
}

function projectStageArtifacts(spec, stage, guard) {
  const activeReaders = new Set();
  if (stage) activeReaders.add(`stage.${stage}`);
  if (guard?.id && (spec.GUARDS ?? []).some((item) => item.id === guard.id)) activeReaders.add(`guard.${guard.id}`);
  return Object.entries(spec.ARTIFACTS ?? {})
    .filter(([, artifact]) => (artifact.readers ?? []).some((reader) => activeReaders.has(reader)))
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(([id, artifact]) => ({ id, path: artifact.path, writer: artifact.writer, template: artifact.template ?? null }));
}

function finalize(decision) {
  const material = { ...decision, decision_id: undefined };
  decision.decision_id = sha256(material);
  return decision;
}

export function checkReads(spec, item, flat, facts, needFields = []) {
  const needs = [];
  for (const field of item.reads ?? []) {
    const declaration = spec.OBSERVATIONS[field];
    if (!declaration) fail("L4", `Undeclared observation read: ${field}`);
    if (!Object.hasOwn(flat, field)) fail("L4", `Observation is absent from snapshot: ${field}`);
    const value = flat[field];
    if (!validateDomainValue(declaration.domain, value).ok) fail("L3", `Observation is outside domain: ${field}`);
    facts.set(field, serializable(value));
    if (isUnknown(value) && !(item.acceptsUnknown ?? []).includes(field)) {
      needs.push(needDescriptor(spec, field, item.body ?? null));
    }
  }
  if (needs.length > 0) {
    const needed = needs.filter((need) => needFields.includes(need.field));
    return { ok: false, reason: needed.length ? `needs ${needed.map((item) => item.field).join(",")}` : `unknown ${needs.map((item) => item.field).join(",")}`, needs };
  }
  return { ok: true, needs: [] };
}

function callPredicate(predicate, s, pointer, predicateTimings) {
  const started = performance.now();
  try { return predicate(s) === true; }
  catch (error) { fail("SR_PREDICATE", `Predicate threw at ${pointer}: ${error.message}`, { pointer, cause: error }); }
  finally { predicateTimings?.push(performance.now() - started); }
}

function terminalStatus(terminal) {
  if (terminal?.startsWith?.("ROUTE:")) return "ROUTE";
  if (["ASK", "WAIT", "BLOCK", "DONE", "NEXT"].includes(terminal)) return terminal;
  return "NEXT";
}

function needDescriptor(spec, field, bodyRef) {
  const source = spec.OBSERVATIONS[field]?.judged ? "judged" : spec.OBSERVATIONS[field]?.decided ? "decided" : "observed";
  return { field, domain: spec.OBSERVATIONS[field]?.domain ?? null, source, body_ref: bodyRef };
}

async function resolveProjection(spec, skillRoot, effects, record, bodyMarkdown) {
  let formatId = record?.format ?? null;
  let templateId = null;
  for (const effect of effects ?? []) {
    if (!Array.isArray(effect)) continue;
    formatId ??= effect[1]?.format ?? null;
    templateId ??= effect[1]?.template ?? null;
    if (effect[1]?.artifact) {
      const artifact = spec.ARTIFACTS?.[effect[1].artifact];
      templateId ??= artifact?.template ?? null;
    }
  }
  const hasProjectedFormat = Boolean(formatId && spec.FORMATS?.[formatId])
    || (effects ?? []).some((effect) => Array.isArray(effect) && spec.FORMATS?.[effect[1]?.format]);
  const formatFixtures = hasProjectedFormat ? await loadFormatFixtures(skillRoot) : null;
  const examples = new Map();
  const exampleFor = (id) => {
    if (!examples.has(id)) {
      const fixture = formatFixtures?.find((item) => item?.format === id && typeof item.expect === "string");
      examples.set(id, fixture ? fixture.expect : formatExample(spec.FORMATS[id]));
    }
    return examples.get(id);
  };
  const projectedEffects = (effects ?? []).map((effect) => {
    if (!Array.isArray(effect) || !spec.FORMATS?.[effect[1]?.format]) return effect;
    return [effect[0], { ...(effect[1] ?? {}), format_example: exampleFor(effect[1].format) }];
  });
  const format = formatId && spec.FORMATS?.[formatId]
    ? { id: formatId, example: exampleFor(formatId) }
    : null;
  let templateText = null;
  if (templateId && spec.TEMPLATES?.[templateId]) templateText = await resolveTemplate(skillRoot, templateId, spec.TEMPLATES[templateId], bodyMarkdown);
  return { effects: projectedEffects, format, template: templateId, templateText };
}

async function loadFormatFixtures(skillRoot) {
  try {
    const fixtures = JSON.parse(await readFile(join(skillRoot, "fixtures", "formats.json"), "utf8"));
    return Array.isArray(fixtures) ? fixtures : null;
  } catch {
    return null;
  }
}

function formatExample(format) {
  const values = { timestamp: "2000-01-01T00:00:00Z" };
  for (const [field, domain] of Object.entries(format.fields ?? {})) values[field] = exampleValue(domain);
  const rendered = format.render(values, { timestamp: values.timestamp });
  return typeof rendered === "string" ? rendered : null;
}

function exampleValue(domain) {
  if (Array.isArray(domain)) return domain[0];
  if (domain && typeof domain === "object") return Object.fromEntries(Object.entries(domain).map(([key, value]) => [key, exampleValue(value)]));
  if (domain.endsWith?.("|NONE")) return domain === "hex40|NONE" ? "0".repeat(40) : "NONE";
  if (domain.startsWith?.("list:")) return [];
  return { integer: 0, hex40: "0".repeat(40), "card-number": "00.1", "card-list": "00.1", path: "path", text: "text", json: {} }[domain] ?? "value";
}

function proofFor(spec, record, effects) {
  const proof = [];
  if (record && !record.reentry) {
    const reference = record.artifact ?? record.format ?? record.message ?? record.field ?? null;
    const path = record.artifact ? spec.ARTIFACTS?.[record.artifact]?.path ?? null : null;
    proof.push({ kind: record.kind ?? "record", reference, ...(path ? { path } : {}) });
  }
  for (const [index, effect] of (effects ?? []).entries()) if (Array.isArray(effect)) proof.push({ kind: "effect", index, verb: effect[0] });
  return proof;
}

function isNoEffectNext(plan) { return Array.isArray(plan) && plan.length === 1 && plan[0] === "NEXT"; }

function serializable(value) {
  if (isUnknown(value)) return { kind: "UNKNOWN", reason: value.reason, details: value.details ?? null };
  if (Array.isArray(value)) return value.map(serializable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serializable(item)]));
  return value;
}
