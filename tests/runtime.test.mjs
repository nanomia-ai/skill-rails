import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { analyzeSpecSource } from "../scripts/runtime/ast-policy.mjs";
import { loadBody } from "../scripts/runtime/body.mjs";
import { line } from "../scripts/runtime/dsl.mjs";
import { validateDomainValue } from "../scripts/runtime/domains.mjs";
import { alignDecision } from "../scripts/runtime/alignment.mjs";
import { alignRun } from "../scripts/runtime/api.mjs";
import { evaluateSpec } from "../scripts/runtime/evaluator.mjs";
import { renderGuide } from "../scripts/runtime/guide.mjs";
import { sha256 } from "../scripts/runtime/hash.mjs";
import { main as runtimeMain } from "../scripts/runtime/cli.mjs";
import { ROOT } from "./helpers.mjs";
import { copyTree } from "../scripts/lib/io.mjs";
import { validateFast, importVerifiedSource } from "../scripts/runtime/validator.mjs";
import { makeTestDir, removeTestDir } from "./helpers.mjs";
import { appendTraceEvent, createTraceEvent, readTrace } from "../scripts/runtime/trace-store.mjs";

test("line formats round-trip exact fields", () => {
  const format = line("result", { count: "integer", verdict: ["pass", "fail"], detail: "text" });
  const rendered = format.render({ count: 2, verdict: "pass", detail: "checked" }, { timestamp: "2026-08-23T00:00:00Z" });
  assert.equal(rendered, "2026-08-23T00:00:00Z result: count: 2; verdict: pass; detail: checked");
  assert.deepEqual(format.parse(rendered), { ok: true, timestamp: "2026-08-23T00:00:00Z", fields: { count: 2, verdict: "pass", detail: "checked" } });
  assert.equal(format.parse(rendered + "\n").ok, false);

  const structured = line("structured", { items: "list:[a|b]", shape: { id: "card-number", state: ["open", "done"] }, payload: "json" });
  const values = { items: ["a", "b"], shape: { id: "00.1", state: "open" }, payload: { text: "; shape: fake", quoted: "\\\"한글" } };
  const structuredLine = structured.render(values, { timestamp: "2026-08-23T00:00:00Z" });
  assert.deepEqual(structured.parse(structuredLine).fields, values);

  const jsonString = line("json-string", { payload: "json" });
  const stringValue = { payload: "; payload: \\\"한글\\\"" };
  assert.deepEqual(jsonString.parse(jsonString.render(stringValue, { timestamp: "2026-08-23T00:00:00Z" })).fields, stringValue);
});

test("named, list, object, NONE, and UNKNOWN domains fail closed", () => {
  const unknown = { __skillRailsUnknown: true, reason: "test" };
  assert.equal(validateDomainValue("integer", 0).ok, true);
  assert.equal(validateDomainValue("integer", -1).ok, false);
  assert.equal(validateDomainValue("hex40|NONE", "NONE").ok, true);
  assert.equal(validateDomainValue("list:[a|b]", ["a", "b"]).ok, true);
  assert.equal(validateDomainValue({ id: "card-number", state: ["open", "done"] }, { id: "00.1", state: "open" }).ok, true);
  assert.equal(validateDomainValue({ id: "card-number" }, { id: "00.1", extra: "x" }).ok, false);
  assert.equal(validateDomainValue("path", "../escape").ok, false);
  assert.equal(validateDomainValue("integer", unknown).unknown, true);
});

test("positive-list permits private pure helpers and derives their reads", async () => {
  const clean = await readFile(join(ROOT, "evals", "g0_5", "b-v5-clean", "spec.mjs"), "utf8");
  const source = clean
    .replace("export const SPEC", "const signalDone = s => s.signal.pass === \"yes\";\n\nexport const SPEC")
    .replace('done: s => s.signal.pass === "yes"', "done: s => signalDone(s)");
  const analysis = analyzeSpecSource(source);
  assert.deepEqual(analysis.diagnostics, []);
  const signal = analysis.predicateReads.find((item) => item.derived.includes("signal.pass"));
  assert.deepEqual(signal.derived, ["signal.pass"]);
});

test("positive-list rejects extra exports, ambient authority, and loose equality", async () => {
  const clean = await readFile(join(ROOT, "evals", "g0_5", "b-v5-clean", "spec.mjs"), "utf8");
  assert.ok(analyzeSpecSource(clean + "\nexport const EXTRA = {};\n").diagnostics.some((item) => item.code === "L0"));
  assert.ok(analyzeSpecSource(clean.replace("export const SPEC", "const leak = process.cwd();\nexport const SPEC")).diagnostics.some((item) => item.code === "L1"));
  assert.ok(analyzeSpecSource(clean.replace('s.signal.pass === "yes"', 's.signal.pass == "yes"')).diagnostics.some((item) => item.code === "L1"));
  assert.ok(analyzeSpecSource(clean.replace('done: s => s.signal.pass === "yes"', 'done: ({ signal }) => signal.pass === "yes"')).diagnostics.some((item) => item.code === "L1"));
  assert.ok(analyzeSpecSource(clean.replace('done: s => s.signal.pass === "yes"', 'done: s => { const alias = s; return alias.signal.pass === "yes"; }')).diagnostics.some((item) => item.code === "L1"));
  assert.ok(analyzeSpecSource(clean.replace('s.signal.pass === "yes"', 's.signal.pass.includes("yes")')).diagnostics.some((item) => item.code === "L4" && /list domain/.test(item.message)));
  const listSource = clean.replace('domain: ["yes", "no"]', 'domain: "list:[yes|no]"');
  assert.equal(analyzeSpecSource(listSource.replace('s.signal.pass === "yes"', 's.signal.pass.length === 0')).diagnostics.some((item) => item.code === "L4"), false);
  assert.equal(analyzeSpecSource(listSource.replace('s.signal.pass === "yes"', 's.signal.pass.length > 0')).diagnostics.some((item) => item.code === "L4"), false);
  assert.ok(analyzeSpecSource(listSource.replace('s.signal.pass === "yes"', 's.signal.pass.length === "a"')).diagnostics.some((item) => item.code === "L4"));
});

test("exclusive tables use their default only when no non-default row matches", async () => {
  const spec = {
    SPEC: { id: "exclusive-default", version: "5" },
    OBSERVATIONS: { "choice.value": { decided: true, domain: ["hit", "miss"] } },
    GUARDS: [],
    STAGES: [{
      id: "choose", reads: ["choice.value"], done: () => false, table: "choice",
      branches: { matched: ["DONE"], fallback: ["BLOCK"] }
    }],
    TABLES: { choice: { exclusive: true, rows: [
      { state: "matched", reads: ["choice.value"], when: s => s.choice.value === "hit" },
      { state: "fallback", reads: [], when: () => true }
    ] } },
    FORMATS: {}, TEMPLATES: {}, ARTIFACTS: {}
  };
  const base = {
    spec, skillRoot: ROOT,
    snapshot: { fingerprint: "sha256:" + "a".repeat(64), status: "stable" },
    runtime: { spec_hash: "sha256:" + "b".repeat(64), runtime_hash: "sha256:" + "c".repeat(64), dsl_hash: "sha256:" + "d".repeat(64), validator_hash: "sha256:" + "e".repeat(64), minimum_node_major: 20 }
  };
  const observations = (value) => ({ flat: { "choice.value": value }, nested: { choice: { value } }, unknowns: [] });
  assert.equal((await evaluateSpec({ ...base, observations: observations("hit") })).row, "matched");
  assert.equal((await evaluateSpec({ ...base, observations: observations("miss") })).row, "fallback");
});

test("selected stages and stopping guards project only their declared static artifacts", async () => {
  const spec = {
    SPEC: { id: "artifact-projection", version: "5" },
    OBSERVATIONS: { "choice.value": { decided: true, domain: ["stage", "guard"] } },
    GUARDS: [{ id: "stop", reads: ["choice.value"], when: s => s.choice.value === "guard", then: "BLOCK" }],
    STAGES: [{ id: "operate", reads: ["choice.value"], done: () => false, effects: ["DONE"] }],
    TABLES: {}, FORMATS: {}, TEMPLATES: {},
    ARTIFACTS: {
      guardInput: { path: "state/guard.json", writer: "external.approver", readers: ["guard.stop"], update: "replace", template: null },
      stageInput: { path: "state/stage.json", writer: "project.consumer", readers: ["stage.operate"], update: "replace", template: null }
    }
  };
  const base = {
    spec, skillRoot: ROOT,
    snapshot: { fingerprint: "sha256:" + "a".repeat(64), status: "stable" },
    runtime: { spec_hash: "sha256:" + "b".repeat(64), runtime_hash: "sha256:" + "c".repeat(64), dsl_hash: "sha256:" + "d".repeat(64), validator_hash: "sha256:" + "e".repeat(64), minimum_node_major: 20 }
  };
  const observations = (value) => ({ flat: { "choice.value": value }, nested: { choice: { value } }, unknowns: [] });
  const stage = await evaluateSpec({ ...base, observations: observations("stage"), decided: { "choice.value": "stage" } });
  assert.deepEqual(stage.stage_artifacts, [{ id: "stageInput", path: "state/stage.json", writer: "project.consumer", template: null }]);
  assert.match(renderGuide(stage), /stage artifacts: \[{"id":"stageInput","path":"state\/stage.json","template":null,"writer":"project.consumer"}\]/);
  const guard = await evaluateSpec({ ...base, observations: observations("guard"), decided: { "choice.value": "guard" } });
  assert.deepEqual(guard.stage_artifacts, [{ id: "guardInput", path: "state/guard.json", writer: "external.approver", template: null }]);
});

test("a skipped judgment NEXT branch cannot leak state into the next selected stage", async () => {
  const firstRecord = { kind: "message", message: "first-stage" };
  const secondRecord = { kind: "artifact", artifact: "secondResult" };
  const secondEffects = [["RUN", { channel: "second-stage" }], ["WRITE", { artifact: "secondResult" }], "NEXT"];
  const spec = {
    SPEC: { id: "stage-coherence", version: "5" },
    OBSERVATIONS: { "route.mode": { decided: true, domain: ["skip"] } },
    GUARDS: [],
    STAGES: [
      { id: "first", reads: ["route.mode"], needs: ["route.mode"], done: () => false, branches: { skip: ["NEXT"] }, record: firstRecord, body: "stage: acquire" },
      { id: "second", reads: [], done: () => false, effects: secondEffects, record: secondRecord, body: "stage: evidence" }
    ],
    TABLES: {}, FORMATS: {}, TEMPLATES: {},
    ARTIFACTS: {
      firstInput: { path: "state/first.json", writer: "project.consumer", readers: ["stage.first"], update: "replace", template: null },
      secondInput: { path: "state/second.json", writer: "project.consumer", readers: ["stage.second"], update: "replace", template: null },
      secondResult: { path: "state/second-result.json", writer: "stage-coherence", readers: ["stage.second"], update: "replace", template: null }
    }
  };
  const input = {
    spec,
    skillRoot: join(ROOT, "fixtures", "next-core-single-skill-pilot", "skill"),
    observations: { flat: { "route.mode": "skip" }, nested: { route: { mode: "skip" } }, unknowns: [] },
    snapshot: { fingerprint: "sha256:" + "a".repeat(64), status: "stable" },
    decided: { "route.mode": "skip" },
    runtime: { spec_hash: "sha256:" + "b".repeat(64), runtime_hash: "sha256:" + "c".repeat(64), dsl_hash: "sha256:" + "d".repeat(64), validator_hash: "sha256:" + "e".repeat(64), minimum_node_major: 20 }
  };
  const decision = await evaluateSpec(input);
  const executionEvents = [];
  const observedDecision = await evaluateSpec({ ...input, evaluationObserver: (event) => executionEvents.push(event) });

  assert.deepEqual(observedDecision, decision);
  assert.equal(JSON.stringify(observedDecision), JSON.stringify(decision));
  assert.equal(observedDecision.decision_id, decision.decision_id);
  assert.deepEqual(executionEvents, [
    { type: "stage_entered", data: { stage: "first" } },
    { type: "branch_selected", data: { stage: "first", row: "skip" } },
    { type: "stage_entered", data: { stage: "second" } }
  ]);
  assert.equal(decision.stage, "second");
  assert.equal(decision.row, null);
  assert.deepEqual(decision.effects, secondEffects);
  assert.deepEqual(decision.record, secondRecord);
  assert.equal(decision.body.ref, "stage-coherence#stage: evidence");
  assert.match(decision.body.markdown, /^## stage: evidence/m);
  assert.deepEqual(decision.proof_required, [
    { kind: "artifact", reference: "secondResult", path: "state/second-result.json" },
    { kind: "effect", index: 0, verb: "RUN" },
    { kind: "effect", index: 1, verb: "WRITE" }
  ]);
  assert.equal(decision.reinvoke, "after-effects");
  assert.deepEqual(decision.stage_artifacts, [
    { id: "secondInput", path: "state/second.json", writer: "project.consumer", template: null },
    { id: "secondResult", path: "state/second-result.json", writer: "stage-coherence", template: null }
  ]);
  assert.equal(Object.hasOwn(decision, "execution_events"), false);
});

test("runtime CLI rejects ambiguous booleans and command-inappropriate options before I/O", async () => {
  const errors = [];
  const io = { log() {}, error(value) { errors.push(String(value)); } };
  assert.equal(await runtimeMain(["lint", "--json", "true"], io), 1);
  assert.match(errors.pop(), /separate value is forbidden/);
  assert.equal(await runtimeMain(["enter", "--fast"], io), 1);
  assert.match(errors.pop(), /not valid for enter/);
  assert.equal(await runtimeMain(["lint", "--fast", "--fast"], io), 1);
  assert.match(errors.pop(), /Duplicate option/);
});

test("verified import rejects spec bytes changed after L-fast", async (t) => {
  const base = await makeTestDir("verified-import");
  t.after(() => removeTestDir(base));
  const root = join(base, "skill");
  await copyTree(join(ROOT, "evals", "g0_5", "b-v5-clean"), root);
  await assert.rejects(loadBody(root, "ko"), (error) => error.code === "L7" && error.pointer === "body_ko.md");
  const fast = await validateFast(root);
  assert.equal(fast.ok, true);
  await writeFile(join(root, "spec.mjs"), `${fast.source}\n// changed after validation\n`, "utf8");
  await assert.rejects(importVerifiedSource(fast), (error) => error.code === "SR_SPEC_CHANGED");
});

test("alignment never upgrades missing or agent-only evidence", () => {
  const decision = sealDecision({
    decision_id: null, spec: { fingerprint: "sha256:" + "b".repeat(64) }, snapshot: { fingerprint: "sha256:" + "c".repeat(64) },
    effects: [["RUN", { check: "test" }]], proof_required: [{ kind: "effect", index: 0 }]
  });
  const emitted = decisionEvent(decision);
  assert.equal(alignDecision(decision, [emitted]).aggregate, "unproven");
  const claimed = traceEvent({ event_id: "claim", sequence: 1, decision_id: decision.decision_id, type: "effect_claimed", authority: "agent_claimed", decision, data: { index: 0, verb: "RUN" } });
  assert.equal(alignDecision(decision, [emitted, claimed]).aggregate, "unproven");
  const observed = [traceEvent({ event_id: "seen", sequence: 1, decision_id: decision.decision_id, type: "effect_observed", authority: "harness_observed", decision, data: { index: 0, verb: "RUN", kind: "effect" } })];
  assert.equal(alignDecision(decision, [emitted, ...observed]).aggregate, "aligned");
});

test("alignment API and CLI reject tampered Decisions before deriving expectations", async (t) => {
  const base = await makeTestDir("alignment-tamper");
  t.after(() => removeTestDir(base));
  const skillRoot = join(base, "skill");
  const traceDir = join(base, "trace");
  await Promise.all([mkdir(skillRoot), mkdir(traceDir)]);
  const decision = sealDecision({
    schema: "urn:nanomia:skill-contract:decision:2",
    decision_id: null,
    spec: { fingerprint: "sha256:" + "b".repeat(64) },
    snapshot: { fingerprint: "sha256:" + "c".repeat(64) },
    restrict: [],
    effects: [["RUN", { check: "test" }]],
    proof_required: [{ kind: "effect", index: 0, verb: "RUN" }],
    stage_artifacts: [{ id: "input", path: "state/input.json", writer: "project.consumer", template: null }]
  });
  const tracePath = join(traceDir, "alignment-run.jsonl");
  await writeFile(tracePath, `${JSON.stringify(decisionEvent(decision))}\n`, "utf8");
  const decisionPath = join(base, "decision.json");
  const cases = [
    ["effects", (value) => { value.effects = []; }],
    ["proof_required", (value) => { value.proof_required = []; }],
    ["restrict", (value) => { value.restrict = ["WRITE"]; }],
    ["stage_artifacts", (value) => { value.stage_artifacts = []; }],
    ["decision_id", (value) => { value.decision_id = "sha256:" + "d".repeat(64); }]
  ];

  for (const [field, mutate] of cases) {
    const tampered = structuredClone(decision);
    mutate(tampered);
    await writeFile(decisionPath, JSON.stringify(tampered), "utf8");
    const apiReport = await alignRun({ decision: tampered, tracePath });
    assert.equal(apiReport.aggregate, "misaligned", `API accepted tampered ${field}`);
    assert.deepEqual(apiReport.expectations, [], `API derived expectations for tampered ${field}`);
    assert.ok(apiReport.issues.some((item) => item.code === "decision-self-seal"), `API missed ${field} self-seal`);

    const output = [];
    const errors = [];
    const exitCode = await runtimeMain([
      "align", "--skill", skillRoot, "--runtime-dir", join(ROOT, "scripts", "runtime"),
      "--decision", decisionPath, "--trace", tracePath
    ], { log(value) { output.push(String(value)); }, error(value) { errors.push(String(value)); } });
    assert.equal(exitCode, 2, `CLI accepted tampered ${field}: ${errors.join("\n")}`);
    const cliReport = JSON.parse(output.at(-1));
    assert.equal(cliReport.aggregate, "misaligned");
    assert.deepEqual(cliReport.expectations, []);
    assert.ok(cliReport.issues.some((item) => item.code === "decision-self-seal"));
  }

  const mismatchedEmission = decisionEvent(decision);
  mismatchedEmission.data.decision = { ...decision, stage_artifacts: [] };
  const mismatchReport = alignDecision(decision, [mismatchedEmission]);
  assert.equal(mismatchReport.aggregate, "misaligned");
  assert.deepEqual(mismatchReport.expectations, []);
  assert.ok(mismatchReport.issues.some((item) => item.code === "decision-emission-mismatch"));

  const recordErrors = [];
  const tampered = structuredClone(decision);
  tampered.effects = [];
  await writeFile(decisionPath, JSON.stringify(tampered), "utf8");
  assert.equal(await runtimeMain([
    "record", "--skill", skillRoot, "--runtime-dir", join(ROOT, "scripts", "runtime"),
    "--decision", decisionPath, "--trace-dir", traceDir, "--run-id", "alignment-run",
    "--type", "effect_claimed", "--data", '{"index":0,"verb":"RUN"}'
  ], { log() {}, error(value) { recordErrors.push(String(value)); } }), 1);
  assert.match(recordErrors.at(-1), /SR_EVIDENCE_DECISION/);

  await writeFile(decisionPath, JSON.stringify(decision), "utf8");
  assert.equal(await runtimeMain([
    "record", "--skill", skillRoot, "--runtime-dir", join(ROOT, "scripts", "runtime"),
    "--decision", decisionPath, "--trace-dir", traceDir, "--run-id", "alignment-run",
    "--type", "effect_claimed", "--data", '{"index":0,"verb":"RUN"}'
  ], { log() {}, error(value) { recordErrors.push(String(value)); } }), 0, recordErrors.join("\n"));
});

test("alignment scopes evidence to one decision and rejects forbidden or out-of-order effects", () => {
  const fingerprint = "sha256:" + "b".repeat(64);
  const snapshot = "sha256:" + "c".repeat(64);
  const decision = sealDecision({
    decision_id: null,
    spec: { fingerprint }, snapshot: { fingerprint: snapshot }, restrict: [],
    effects: [["RUN", { check: "test" }], ["WRITE", { artifact: "result" }]],
    proof_required: [{ kind: "effect", index: 0, verb: "RUN" }, { kind: "effect", index: 1, verb: "WRITE" }]
  });
  const event = (id, decisionId, sequence, index, verb, extra = {}) => createTraceEvent({ event_id: id, run_id: "alignment-run", at: "2026-08-23T00:00:00.000Z", sequence, decision_id: decisionId, type: "effect_observed", authority: "harness_observed", spec_fingerprint: fingerprint, snapshot_fingerprint: extra.snapshot_fingerprint ?? snapshot, data: { index, verb, kind: "effect" } });

  const otherDecision = [event("other", "sha256:" + "d".repeat(64), 0, 0, "RUN")];
  assert.equal(alignDecision(decision, otherDecision).aggregate, "misaligned");

  const emitted = decisionEvent(decision);
  const ordered = [emitted, event("run", decision.decision_id, 1, 0, "RUN"), event("write", decision.decision_id, 2, 1, "WRITE")];
  assert.equal(alignDecision(decision, ordered).aggregate, "aligned");
  const reversed = [emitted, event("write-first", decision.decision_id, 1, 1, "WRITE"), event("run-second", decision.decision_id, 2, 0, "RUN")];
  assert.equal(alignDecision(decision, reversed).aggregate, "misaligned");
  const duplicate = alignDecision(decision, [...ordered, event("run-again", decision.decision_id, 3, 0, "RUN")]);
  assert.ok(duplicate.issues.some((item) => item.code === "duplicate-effect"));

  const blocked = sealDecision({ ...decision, decision_id: null, effects: [], proof_required: [], restrict: ["WRITE"] });
  const forbidden = [decisionEvent(blocked), event("forbidden", blocked.decision_id, 1, 0, "WRITE")];
  const report = alignDecision(blocked, forbidden);
  assert.equal(report.aggregate, "misaligned");
  assert.deepEqual(report.issues.map((item) => item.code).sort(), ["restricted-effect", "unplanned-effect"]);

  const confessed = sealDecision({
    decision_id: null, spec: { fingerprint }, snapshot: { fingerprint: snapshot }, restrict: ["WRITE"],
    effects: [["REPORT", { template: "result" }]], proof_required: [{ kind: "effect", index: 0, verb: "REPORT" }]
  });
  const confession = traceEvent({ event_id: "claim-write", sequence: 2, decision_id: confessed.decision_id, type: "effect_claimed", authority: "agent_claimed", decision: confessed, data: { index: 0, verb: "WRITE", kind: "effect" } });
  const confessedReport = alignDecision(confessed, [decisionEvent(confessed), event("report", confessed.decision_id, 1, 0, "REPORT"), confession]);
  assert.equal(confessedReport.aggregate, "misaligned");
  assert.deepEqual(confessedReport.issues.map((item) => item.code).sort(), ["claimed-restricted-effect", "claimed-unplanned-effect"]);

  const unplannedClaim = traceEvent({ event_id: "claim-report", sequence: 3, decision_id: decision.decision_id, type: "effect_claimed", authority: "agent_claimed", decision, data: { index: 9, verb: "REPORT", kind: "effect" } });
  const partial = alignDecision(decision, [...ordered, unplannedClaim]);
  assert.equal(partial.aggregate, "partial");
  assert.ok(partial.issues.some((item) => item.code === "claimed-unplanned-effect"));

  const unrelatedStale = [event("old", "sha256:" + "f".repeat(64), 0, 0, "RUN", { snapshot_fingerprint: "sha256:" + "0".repeat(64) })];
  assert.equal(alignDecision(decision, unrelatedStale).aggregate, "misaligned");
});

test("trace store serializes concurrent writers and rejects duplicate run emissions", async (t) => {
  const base = await makeTestDir("trace-concurrency");
  t.after(() => removeTestDir(base));
  await Promise.all([...Array(64).keys()].map((index) => appendTraceEvent(base, {
    run_id: "parallel-run", type: "proof_recorded", authority: "agent_claimed", data: { index }
  })));
  const path = join(base, "parallel-run.jsonl");
  const events = await readTrace(path);
  assert.equal(events.length, 64);
  assert.deepEqual(events.map((event) => event.sequence), [...Array(64).keys()]);
  const fingerprint = "sha256:" + "a".repeat(64);
  await appendTraceEvent(base, { run_id: "emission-run", type: "decision_emitted", authority: "runtime_observed", decision_id: fingerprint, data: {} });
  await assert.rejects(
    appendTraceEvent(base, { run_id: "emission-run", type: "decision_emitted", authority: "runtime_observed", decision_id: fingerprint, data: {} }),
    (error) => error.code === "SR_TRACE_INVALID"
  );

  const installedSkill = join(base, "installed-skill");
  const externalTrace = join(base, "external-trace");
  await Promise.all([mkdir(installedSkill), mkdir(externalTrace)]);
  const resumeDecision = sealDecision({
    decision_id: null,
    spec: { fingerprint: "sha256:" + "b".repeat(64) },
    snapshot: { fingerprint: "sha256:" + "c".repeat(64) },
    restrict: [], effects: [], proof_required: []
  });
  await appendTraceEvent(externalTrace, {
    run_id: "resume-run", type: "decision_emitted", authority: "runtime_observed",
    decision_id: resumeDecision.decision_id, spec_fingerprint: resumeDecision.spec.fingerprint,
    snapshot_fingerprint: resumeDecision.snapshot.fingerprint, data: { decision: resumeDecision }
  });
  const output = [];
  const errors = [];
  const resumed = await runtimeMain([
    "resume", "--skill", installedSkill, "--runtime-dir", join(ROOT, "scripts", "runtime"),
    "--trace", join(externalTrace, "resume-run.jsonl"), "--project", join(base, "project"), "--json"
  ], { log(value) { output.push(String(value)); }, error(value) { errors.push(String(value)); } });
  assert.equal(resumed, 0, errors.join("\n"));
  const resumeReport = JSON.parse(output[0]);
  assert.match(resumeReport.next_command, new RegExp(escapeRegExp(join(ROOT, "scripts", "runtime", "run.mjs"))));
  assert.match(resumeReport.next_command, /--trace-dir/);
  assert.match(resumeReport.next_command, /--run-id \"resume-run\"/);
});

function decisionEvent(decision) {
  return traceEvent({ event_id: "decision-" + decision.decision_id.slice(-8), sequence: 0, decision_id: decision.decision_id, type: "decision_emitted", authority: "runtime_observed", decision, data: { decision } });
}

function traceEvent({ decision, ...event }) {
  return createTraceEvent({
    run_id: "alignment-run", at: "2026-08-23T00:00:00.000Z",
    spec_fingerprint: decision.spec.fingerprint, snapshot_fingerprint: decision.snapshot.fingerprint,
    ...event
  });
}

function sealDecision(decision) {
  decision.decision_id = sha256({ ...decision, decision_id: undefined });
  return decision;
}

function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
