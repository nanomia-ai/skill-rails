import test from "node:test";
import assert from "node:assert/strict";
import { appendFile, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import Ajv2020 from "ajv/dist/2020.js";
import { generatePackage, P2_PACKAGE_GITATTRIBUTES } from "../skills/skill-rails/scripts/lib/generator.mjs";
import { lintSimpleSkill } from "../skills/skill-rails/scripts/lib/simple-lint.mjs";
import { measureSimpleContextSurface } from "../skills/skill-rails/scripts/lib/context-surface.mjs";
import { buildP2, runFixtureSuite } from "../skills/skill-rails/scripts/lib/build-core.mjs";
import { copyTree, exists, listFiles, readJson, writeJsonAtomic, writeTextAtomic } from "../skills/skill-rails/scripts/lib/io.mjs";
import { enterSkill, simulateSkill, stageSkill } from "../skills/skill-rails/scripts/runtime/api.mjs";
import { loadBuiltSkill } from "../skills/skill-rails/scripts/runtime/loader.mjs";
import { alignDecision } from "../skills/skill-rails/scripts/runtime/alignment.mjs";
import { assertExternalStateDir, readTrace, recordHarnessEvidence } from "../skills/skill-rails/scripts/runtime/trace-core.mjs";
import { main as runtimeMain } from "../skills/skill-rails/scripts/runtime/cli.mjs";
import { hashFile } from "../skills/skill-rails/scripts/runtime/hash.mjs";
import { captureSnapshot } from "../skills/skill-rails/scripts/runtime/snapshot.mjs";
import { resolveTemplate } from "../skills/skill-rails/scripts/runtime/templates.mjs";
import { validateFull } from "../skills/skill-rails/scripts/runtime/validator.mjs";
import { ROOT, SKILL_ROOT, makeTestDir, removeTestDir } from "./helpers.mjs";

test("P0 and P1 stay thin while P2 is self-contained and executable", async (t) => {
  const base = await makeTestDir("profiles");
  t.after(() => removeTestDir(base));
  const outputs = {};
  let p2Build = null;
  for (const profile of ["p0", "p1", "p2"]) {
    const intent = await readJson(join(ROOT, "fixtures", "intents", `${profile}.json`));
    const output = join(base, profile);
    outputs[profile] = output;
    const result = await generatePackage({
      intent, output,
      finalize: async (stage, selection) => { if (selection.profile === "p2") p2Build = await buildP2(stage, { repeats: 10 }); }
    });
    assert.equal(result.profile, profile);
  }
  assert.equal(await exists(join(outputs.p0, "spec.mjs")), false);
  assert.equal(await exists(join(outputs.p0, "scripts")), false);
  assert.equal(await exists(join(outputs.p0, "references", "intent.md")), false);
  assert.equal(await exists(join(outputs.p1, "spec.mjs")), false);
  assert.equal(await exists(join(outputs.p1, "scripts", "run.mjs")), true);
  assert.equal(await exists(join(outputs.p2, "spec.mjs")), true);
  assert.equal(await exists(join(outputs.p2, "references", "guidance-index.md")), false);
  assert.equal(await exists(join(outputs.p2, "scripts", "skill-rails", "vendor", "acorn.mjs")), true);
  assert.equal(await exists(join(outputs.p2, ".generated.json")), true);
  assert.equal(await exists(join(outputs.p0, ".gitattributes")), false);
  assert.equal(await exists(join(outputs.p1, ".gitattributes")), false);
  assert.equal(await readFile(join(outputs.p2, ".gitattributes"), "utf8"), P2_PACKAGE_GITATTRIBUTES);
  for (const profile of ["p0", "p1"]) {
    const simpleSkill = await readFile(join(outputs[profile], "SKILL.md"), "utf8");
    assert.match(simpleSkill, /repeated small fixes stop moving the user's requested result closer/);
    assert.match(simpleSkill, /confirm that the check and its setup observe the stated outcome/);
  }
  const p1Intent = await readJson(join(ROOT, "fixtures", "intents", "p1.json"));
  assert.ok(p1Intent.description.length > 80);
  const p1Skill = await readFile(join(outputs.p1, "SKILL.md"), "utf8");
  assert.match(p1Skill, /If `node <this-skill>\/scripts\/run\.mjs` emits `SR_P1_SCAFFOLD`, authoring is incomplete/);
  assert.doesNotMatch(p1Skill, /Before first use, replace the marked P1 helper scaffold/);
  const p1Adapter = await readFile(join(outputs.p1, "agents", "openai.yaml"), "utf8");
  assert.ok(p1Adapter.includes(p1Intent.description), p1Adapter);
  const p2Skill = await readFile(join(outputs.p2, "SKILL.md"), "utf8");
  assert.match(p2Skill, /current task explicitly identifies a complete saved stage-result file/);
  assert.match(p2Skill, /If any condition is absent or uncertain, run `node "<skill-root>\/scripts\/skill-rails\/run\.mjs" stage/);
  assert.match(p2Skill, /Use judgment only within domain work that the current Decision leaves open/);
  assert.match(p2Skill, /never skip, reorder, or substitute for the Decision/);
  assert.match(p2Skill, /Decision body, `stage_artifacts`, and ordered effects/);
  assert.match(p2Skill, /processing every effect in order through the final terminal/);
  assert.match(p2Skill, /ASK, WAIT, BLOCK, DONE, and ROUTE stop only when reached after all preceding effects/);
  assert.doesNotMatch(p2Skill, /Stop on a diagnostic, stale snapshot, BLOCK, ASK, or WAIT/);
  assert.match(p2Skill, /Do not infer replacement paths from collector or authoring files/);
  // The bootstrap must not claim a package meaning for an effect argument: the runtime renders those
  // verbatim, and version 5 lets a spec use `path` for whatever its own instruction means.
  assert.doesNotMatch(p2Skill, /`READ` effect's `path`/, "the bootstrap may not reserve an effect argument version 5 left open");
  assert.match(p2Skill, /current task or role already identifies one project-relative file target/);
  assert.match(p2Skill, /add `--target "<path>"`; never infer a target, and omit the option/);
  assert.match(p2Skill, /artifact_verified --data '\{"reference":"<proof\.reference>"\}'/);
  assert.match(p2Skill, /matching proof reference from the current Decision/);
  assert.doesNotMatch(p2Skill, /BLOCK: consumer guidance missing/);
  assert.match(p2Skill, /bound to the exact Decision/);
  assert.match(p2Skill, /do not automatically carry to the new Decision/);
  assert.equal((await readFile(join(outputs.p2, "scripts", "skill-rails", "manifest.mjs"), "utf8")).includes("\r"), false);
  assert.equal((await readFile(join(outputs.p2, "schemas", "decision.schema.json"), "utf8")).includes("\r"), false);
  const manifest = await readJson(join(outputs.p2, ".generated.json"));
  assert.match(manifest.generated_files[".gitattributes"], /^sha256:[0-9a-f]{64}$/);
  assert.equal(manifest.evidence.mutations.passed, 20);
  assert.equal(manifest.evidence.mutations.survivors.length, 0);
  assert.equal(manifest.evidence.fixtures.mismatches, 0);
  assert.ok(manifest.evidence.fixtures.predicate_evaluations > 0);
  assert.deepEqual(manifest.evidence.fixtures.predicate_performance, { status: "pass", limit_ms: 50 });
  assert.ok(p2Build.fixtures.predicate_evaluation_p99_ms < 50);
  const p0Ledger = await readJson(join(outputs.p0, ".skill-rails", "obligation-ledger.json"));
  assert.ok(p0Ledger.atoms.length > 2 && p0Ledger.atoms.every((atom) => atom.disposition === "projected"));
  const p1Ledger = await readJson(join(outputs.p1, ".skill-rails", "obligation-ledger.json"));
  assert.ok(p1Ledger.atoms.some((atom) => atom.disposition === "review-required" && atom.candidate_class === "format"));
  const p2Cases = await readJson(join(outputs.p2, ".skill-rails", "eval-cases.json"));
  assert.ok(p2Cases[0].forbidden_actions.some((item) => item.includes("publishing a release")));

  const p0Eval = spawnSync(process.execPath, [join(SKILL_ROOT, "scripts", "eval.mjs"), "--skill", outputs.p0], { cwd: ROOT, encoding: "utf8", windowsHide: true });
  const p1Eval = spawnSync(process.execPath, [join(SKILL_ROOT, "scripts", "eval.mjs"), "--skill", outputs.p1], { cwd: ROOT, encoding: "utf8", windowsHide: true });
  assert.equal(p0Eval.status, 1);
  assert.equal(JSON.parse(p0Eval.stdout).release_readiness, "forward-test-required");
  assert.equal(p1Eval.status, 1);
  assert.equal(JSON.parse(p1Eval.stdout).release_readiness, "helper-implementation-required");
  const p1Run = spawnSync(process.execPath, [join(outputs.p1, "scripts", "run.mjs")], { cwd: ROOT, encoding: "utf8", windowsHide: true });
  assert.equal(p1Run.status, 2);
  assert.match(p1Run.stderr, /SR_P1_SCAFFOLD/);

  const entered = await enterSkill({ skillRoot: outputs.p2 });
  assert.equal(entered.schema, "skill-rails/enter/1");
  assert.match(entered.enter_hash, /^sha256:[0-9a-f]{64}$/);
  const deferred = await stageSkill({ skillRoot: outputs.p2, projectRoot: ROOT, decided: { "authoring.readiness": "ready" } });
  assert.equal(deferred.decision.status, "BLOCK");
  assert.equal(deferred.decision.guard.id, "authoring-deferred");
  assert.equal((await stageSkill({ skillRoot: outputs.p2, decided: { "authoring.readiness": "ready" } })).decision.guard.id, "authoring-deferred");
  const scaffoldSpecPath = join(outputs.p2, "spec.mjs");
  const scaffoldSpec = await readFile(scaffoldSpecPath, "utf8");
  await writeTextAtomic(scaffoldSpecPath, scaffoldSpec.replace(/export const DEFERRED = \[[\s\S]*?\];\s*$/, "export const DEFERRED = [];\n"));
  const premature = await validateFull(outputs.p2);
  assert.ok(premature.diagnostics.some((item) => item.code === "L16" && /review-required/.test(item.message)));
  await writeTextAtomic(scaffoldSpecPath, scaffoldSpec);
  await completeGeneratedP2ForRuntimeTest(outputs.p2);
  await buildP2(outputs.p2, { repeats: 1 });
  const unknown = await stageSkill({ skillRoot: outputs.p2, projectRoot: ROOT });
  assert.deepEqual(unknown.decision.needs.map((item) => item.field), ["authoring.readiness"]);
  const ready = await stageSkill({ skillRoot: outputs.p2, projectRoot: ROOT, decided: { "authoring.readiness": "ready" } });
  assert.equal(ready.decision.status, "DONE");
  assert.equal(ready.decision.stage, "operate");
  assert.deepEqual(ready.decision.snapshot.unknowns, []);
  const decisionSchema = await readJson(join(outputs.p2, "schemas", "decision.schema.json"));
  const validateDecision = new Ajv2020({ strict: true, allErrors: true, validateFormats: false, allowUnionTypes: true }).compile(decisionSchema);
  for (const decision of [deferred.decision, unknown.decision, ready.decision]) assert.equal(validateDecision(decision), true, JSON.stringify(validateDecision.errors));
});

test("pilot stage-artifact fixtures fail when one stage reader association is removed", async (t) => {
  const base = await makeTestDir("stage-artifact-reader");
  t.after(() => removeTestDir(base));
  const skill = join(base, "skill");
  await copyTree(join(ROOT, "fixtures", "next-core-single-skill-pilot", "skill"), skill);
  const specPath = join(skill, "spec.mjs");
  const source = await readFile(specPath, "utf8");
  await writeTextAtomic(specPath, source.replace('readers: ["stage.acquire", "stage.evidence"], update: "replace"', 'readers: ["stage.evidence"], update: "replace"'));
  const validation = await validateFull(skill);
  assert.ok(validation.diagnostics.some((item) => item.code === "L14" && /stage artifacts/.test(item.message)), JSON.stringify(validation.diagnostics));
});

test("P0 and P1 route only declared conditional judgment topics", async (t) => {
  const base = await makeTestDir("progressive-guidance");
  t.after(() => removeTestDir(base));
  const p0Intent = await readJson(join(ROOT, "fixtures", "intents", "p0.json"));
  p0Intent.judgment_points = [
    "Keep the review evidence-aware.",
    {
      id: "meaning-risk",
      when: "A proposed tone change could alter a factual claim.",
      points: [
        "Identify the exact claim before proposing new wording.",
        "Explain why the revised wording preserves the original meaning."
      ]
    },
    {
      id: "reader-fit",
      when: "The reader expertise is materially different from the source audience.",
      points: ["Adjust explanation depth without deleting necessary qualifications."]
    }
  ];
  const p0 = join(base, "p0");
  await generatePackage({ intent: p0Intent, output: p0 });
  const skill = await readFile(join(p0, "SKILL.md"), "utf8");
  const index = await readFile(join(p0, "references", "guidance-index.md"), "utf8");
  assert.match(skill, /Keep the review evidence-aware/);
  assert.match(skill, /references\/guidance-index\.md/);
  assert.doesNotMatch(skill, /Identify the exact claim/);
  assert.doesNotMatch(skill, /reader expertise is materially different/);
  assert.match(index, /meaning-risk/);
  assert.match(index, /reader-fit/);
  assert.match(await readFile(join(p0, "references", "guidance", "meaning-risk.md"), "utf8"), /revised wording preserves/);
  assert.equal((await lintSimpleSkill(p0)).ok, true);

  const ledger = await readJson(join(p0, ".skill-rails", "obligation-ledger.json"));
  assert.equal(ledger.schema, "skill-rails/obligation-ledger/2");
  assert.ok(ledger.atoms.some((atom) => atom.id === "judgment-topic-meaning-risk-when" && atom.targets.includes("file:references/guidance-index.md")));
  assert.ok(ledger.atoms.some((atom) => atom.id === "judgment-topic-meaning-risk-point-001" && atom.targets.includes("file:references/guidance/meaning-risk.md")));
  assert.equal(ledger.atoms.some((atom) => atom.targets?.includes("file:references/intent.md")), false);

  const largeIntent = structuredClone(p0Intent);
  largeIntent.judgment_points[1].points = ["x".repeat(20000)];
  const large = join(base, "large-p0");
  await generatePackage({ intent: largeIntent, output: large });
  const [smallSurface, largeSurface] = await Promise.all([measureSimpleContextSurface(p0), measureSimpleContextSurface(large)]);
  assert.equal(largeSurface.entry_bytes, smallSurface.entry_bytes);
  assert.equal(largeSurface.routing_index_bytes, smallSurface.routing_index_bytes);
  assert.ok(largeSurface.on_demand_total_bytes > smallSurface.on_demand_total_bytes + 19000);
  assert.ok(largeSurface.fixed_context_bytes < largeSurface.total_guidance_bytes);
  const evaluated = spawnSync(process.execPath, [join(SKILL_ROOT, "scripts", "eval.mjs"), "--skill", p0], { cwd: ROOT, encoding: "utf8", windowsHide: true });
  assert.equal(evaluated.status, 1);
  assert.deepEqual(JSON.parse(evaluated.stdout).context_surface, smallSurface);

  const p1Intent = await readJson(join(ROOT, "fixtures", "intents", "p1.json"));
  p1Intent.judgment_points = [p0Intent.judgment_points[1]];
  const p1 = join(base, "p1");
  await generatePackage({ intent: p1Intent, output: p1 });
  const p1Skill = await readFile(join(p1, "SKILL.md"), "utf8");
  assert.match(p1Skill, /SR_P1_SCAFFOLD/);
  assert.match(p1Skill, /fixed release-note heading/);
  assert.doesNotMatch(p1Skill, /Identify the exact claim/);
  assert.equal((await lintSimpleSkill(p1)).ok, true);
});

test("progressive guidance lint fails closed on routing drift and orphans", async (t) => {
  const base = await makeTestDir("progressive-guidance-lint");
  t.after(() => removeTestDir(base));
  const root = join(base, "skill");
  const intent = await readJson(join(ROOT, "fixtures", "intents", "p0.json"));
  intent.judgment_points = [{ id: "claim-risk", when: "A revision changes a claim.", points: ["Preserve the claim."] }];
  await generatePackage({ intent, output: root });
  const topicPath = join(root, "references", "guidance", "claim-risk.md");
  const originalTopic = await readFile(topicPath, "utf8");
  await writeFile(topicPath, originalTopic.replace("Preserve the claim.", "REMOVED TOPIC POINT"), "utf8");
  let lint = await lintSimpleSkill(root);
  assert.ok(lint.diagnostics.some((item) => item.code === "SR_LEDGER_TEXT"), "topic target text remains required");
  await writeFile(topicPath, originalTopic, "utf8");
  const indexPath = join(root, "references", "guidance-index.md");
  const originalIndex = await readFile(indexPath, "utf8");
  await writeFile(indexPath, originalIndex.replace("| `claim-risk`", "| `different-id`"), "utf8");
  lint = await lintSimpleSkill(root);
  assert.ok(lint.diagnostics.some((item) => ["SR_GUIDANCE_PATH", "SR_GUIDANCE_INTENT"].includes(item.code)));
  await writeFile(indexPath, originalIndex, "utf8");
  await writeFile(join(root, "references", "guidance", "orphan.md"), "# Orphan\n", "utf8");
  lint = await lintSimpleSkill(root);
  assert.ok(lint.diagnostics.some((item) => item.code === "SR_GUIDANCE_ORPHAN"));
  await mkdir(join(root, "references", "guidance", "nested"));
  await writeFile(join(root, "references", "guidance", "nested", "orphan.md"), "# Nested orphan\n", "utf8");
  await writeFile(join(root, "references", "guidance", "UPPERCASE.MD"), "# Uppercase orphan\n", "utf8");
  lint = await lintSimpleSkill(root);
  assert.ok(lint.diagnostics.some((item) => item.code === "SR_GUIDANCE_ORPHAN" && /nested/.test(item.pointer)));
  assert.ok(lint.diagnostics.some((item) => item.code === "SR_GUIDANCE_ORPHAN" && /UPPERCASE\.MD/.test(item.pointer)));
});

test("conditional routing round-trips prose punctuation and rejects invalid UTF-8", async (t) => {
  const base = await makeTestDir("progressive-guidance-text");
  t.after(() => removeTestDir(base));
  const root = join(base, "skill");
  const intent = await readJson(join(ROOT, "fixtures", "intents", "p0.json"));
  intent.judgment_points = [{
    id: "path-table-risk",
    when: "  A \\ path | table cell, C:/example, or 한글 label affects the requested judgment.  ",
    points: ["Preserve Unicode, a literal | delimiter, and a \\ character exactly."]
  }];
  await generatePackage({ intent, output: root });
  assert.equal((await lintSimpleSkill(root)).ok, true);
  const index = await readFile(join(root, "references", "guidance-index.md"), "utf8");
  assert.match(index, /\\\| table cell/);
  assert.match(index, /C:\/example/);
  await appendFile(join(root, "references", "guidance", "path-table-risk.md"), Uint8Array.from([0xff]));
  const invalid = await lintSimpleSkill(root);
  assert.ok(invalid.diagnostics.some((item) => ["SR_GUIDANCE_LINK", "SR_GUIDANCE_PATH", "SR_LEDGER_LOCATOR"].includes(item.code)));
});

test("simple lint detects deletion of every canonical intent requirement", async (t) => {
  const base = await makeTestDir("simple-intent-preservation");
  t.after(() => removeTestDir(base));
  const root = join(base, "skill");
  const intent = {
    name: "intent-preservation-probe",
    description: "Use this uniquely described probe when every declared intent atom must remain traceable in a simple skill package.",
    problem: "PROBLEM-UNIQUE must never disappear from the generated instructions.",
    use_cases: ["USE-CASE-UNIQUE request applies."],
    near_misses: ["NEAR-MISS-UNIQUE request does not apply."],
    inputs: ["INPUT-UNIQUE artifact"],
    outputs: ["OUTPUT-UNIQUE artifact"],
    irreversible_boundaries: ["BOUNDARY-UNIQUE action"],
    state_dependent_behaviors: ["STATE-UNIQUE behavior"],
    exact_formats: ["FORMAT-UNIQUE contract"],
    external_dependencies: ["DEPENDENCY-UNIQUE service"],
    completion_evidence: ["EVIDENCE-UNIQUE receipt"],
    judgment_points: ["JUDGMENT-UNIQUE question"],
    deterministic_helpers: ["HELPER-UNIQUE transformation"]
  };
  await generatePackage({ intent, output: root, requestedProfile: "p0" });
  const skillPath = join(root, "SKILL.md");
  const original = await readFile(skillPath, "utf8");
  const texts = [intent.description, intent.problem, ...Object.values(intent).filter(Array.isArray).flat()];
  for (const text of texts) {
    assert.ok(original.includes(text));
    await writeFile(skillPath, original.replace(text, `REMOVED-${text.length}`), "utf8");
    const lint = await lintSimpleSkill(root);
    assert.ok(lint.diagnostics.some((item) => item.code === "SR_LEDGER_TEXT"), `missing SR_LEDGER_TEXT for ${text}`);
  }
  await writeFile(skillPath, original, "utf8");
  assert.equal((await lintSimpleSkill(root)).ok, true);
});

test("progressive routing rejects symlink and junction escapes", async (t) => {
  const base = await makeTestDir("progressive-guidance-links");
  t.after(() => removeTestDir(base));
  const intent = await readJson(join(ROOT, "fixtures", "intents", "p0.json"));
  intent.judgment_points = [{ id: "claim-risk", when: "A claim changes.", points: ["Preserve the claim."] }];
  async function generated(name) {
    const root = join(base, name);
    await generatePackage({ intent, output: root });
    return root;
  }
  const directoryRoot = await generated("directory-link");
  const outsideDirectory = join(base, "outside-guidance");
  await mkdir(outsideDirectory);
  await writeFile(join(outsideDirectory, "claim-risk.md"), await readFile(join(directoryRoot, "references", "guidance", "claim-risk.md")));
  await rm(join(directoryRoot, "references", "guidance"), { recursive: true });
  await symlink(outsideDirectory, join(directoryRoot, "references", "guidance"), "junction");
  assert.ok((await lintSimpleSkill(directoryRoot)).diagnostics.some((item) => ["SR_GUIDANCE_PATH", "SR_GUIDANCE_LINK"].includes(item.code)));

  try {
    const indexRoot = await generated("index-link");
    const outsideIndex = join(base, "outside-index.md");
    const indexPath = join(indexRoot, "references", "guidance-index.md");
    await writeFile(outsideIndex, await readFile(indexPath));
    await rm(indexPath);
    await symlink(outsideIndex, indexPath, "file");
    assert.ok((await lintSimpleSkill(indexRoot)).diagnostics.some((item) => item.code === "SR_GUIDANCE_PATH"));

    const topicRoot = await generated("topic-link");
    const topicPath = join(topicRoot, "references", "guidance", "claim-risk.md");
    const outsideTopic = join(base, "outside-topic.md");
    await writeFile(outsideTopic, await readFile(topicPath));
    await rm(topicPath);
    await symlink(outsideTopic, topicPath, "file");
    assert.ok((await lintSimpleSkill(topicRoot)).diagnostics.some((item) => ["SR_GUIDANCE_PATH", "SR_GUIDANCE_LINK", "SR_LEDGER_LOCATOR"].includes(item.code)));

    const targetRoot = await generated("target-link");
    const targetTopic = join(targetRoot, "references", "guidance", "claim-risk.md");
    await appendFile(targetTopic, "\n[extra](extra.md)\n", "utf8");
    const outsideExtra = join(base, "outside-extra.md");
    await writeFile(outsideExtra, "# Extra\n", "utf8");
    await symlink(outsideExtra, join(targetRoot, "references", "guidance", "extra.md"), "file");
    assert.ok((await lintSimpleSkill(targetRoot)).diagnostics.some((item) => ["SR_GUIDANCE_PATH", "SR_SKILL_LINK"].includes(item.code)));
  } catch (error) {
    if (["EPERM", "EACCES"].includes(error.code)) t.diagnostic(`file symlink creation unavailable; junction escape was still verified: ${error.code}`);
    else throw error;
  }
});

test("P1 evaluation validates its decision, helper, and authoring obligations", async (t) => {
  const base = await makeTestDir("p1-evaluation-boundary");
  t.after(() => removeTestDir(base));
  const intent = await readJson(join(ROOT, "fixtures", "intents", "p1.json"));

  const missing = join(base, "missing-helper");
  await generatePackage({ intent, output: missing });
  await rm(join(missing, "scripts", "run.mjs"));
  assert.ok((await lintSimpleSkill(missing)).diagnostics.some((item) => item.code === "SR_P1_HELPER"));
  const missingEval = spawnSync(process.execPath, [join(SKILL_ROOT, "scripts", "eval.mjs"), "--skill", missing], { cwd: ROOT, encoding: "utf8", windowsHide: true });
  assert.equal(JSON.parse(missingEval.stdout).release_readiness, "invalid");

  const drift = join(base, "decision-drift");
  await generatePackage({ intent, output: drift });
  const decisionPath = join(drift, ".skill-rails", "profile-decision.json");
  const decision = await readJson(decisionPath);
  await writeJsonAtomic(decisionPath, { ...decision, profile: "p0" });
  assert.ok((await lintSimpleSkill(drift)).diagnostics.some((item) => item.code === "SR_PROFILE_DECISION"));

  const complete = join(base, "complete");
  await generatePackage({ intent, output: complete });
  const helperPath = join(complete, "scripts", "run.mjs");
  const scaffold = await readFile(helperPath, "utf8");
  await writeFile(helperPath, scaffold.replace("// @skill-rails scaffold: replace this body with the approved deterministic helper and tests.\n", ""), "utf8");
  let evaluated = spawnSync(process.execPath, [join(SKILL_ROOT, "scripts", "eval.mjs"), "--skill", complete], { cwd: ROOT, encoding: "utf8", windowsHide: true });
  assert.equal(JSON.parse(evaluated.stdout).release_readiness, "helper-implementation-required");

  await mkdir(join(complete, "tests"));
  await writeFile(helperPath, "#!/usr/bin/env node\nprocess.stdout.write(\"ready\\n\");\n", "utf8");
  await writeFile(join(complete, "tests", "helper.test.mjs"), "// golden helper evidence\n", "utf8");
  const ledgerPath = join(complete, ".skill-rails", "obligation-ledger.json");
  const ledger = await readJson(ledgerPath);
  assert.ok(ledger.atoms.some((item) => item.disposition === "review-required"), "P1 authoring obligations default to review-required");
  evaluated = spawnSync(process.execPath, [join(SKILL_ROOT, "scripts", "eval.mjs"), "--skill", complete], { cwd: ROOT, encoding: "utf8", windowsHide: true });
  assert.equal(JSON.parse(evaluated.stdout).release_readiness, "authoring-obligations-required");
  for (const atom of ledger.atoms.filter((item) => item.disposition === "review-required")) {
    atom.disposition = "projected";
    atom.targets = ["file:scripts/run.mjs"];
    atom.evidence = ["file:tests/helper.test.mjs"];
  }
  await writeJsonAtomic(ledgerPath, ledger);
  assert.equal((await lintSimpleSkill(complete)).ok, true);

  const skillPath = join(complete, "SKILL.md");
  const skill = await readFile(skillPath, "utf8");
  await writeFile(skillPath, skill.replace(intent.exact_formats[0], "REMOVED FORMAT INTENT"), "utf8");
  assert.ok((await lintSimpleSkill(complete)).diagnostics.some((item) => item.code === "SR_LEDGER_TEXT"), "universal intent remains required in SKILL.md");
  await writeFile(skillPath, skill, "utf8");

  const projected = ledger.atoms.find((item) => item.source.startsWith("intent.exact_formats"));
  const originalTargets = projected.targets;
  projected.targets = ["file:scripts/missing-helper.mjs"];
  await writeJsonAtomic(ledgerPath, ledger);
  assert.ok((await lintSimpleSkill(complete)).diagnostics.some((item) => item.code === "SR_LEDGER_LOCATOR"), "projected locators remain fail-closed");
  projected.targets = originalTargets;
  await writeJsonAtomic(ledgerPath, ledger);
  assert.equal((await lintSimpleSkill(complete)).ok, true);
  evaluated = spawnSync(process.execPath, [join(SKILL_ROOT, "scripts", "eval.mjs"), "--skill", complete], { cwd: ROOT, encoding: "utf8", windowsHide: true });
  assert.equal(JSON.parse(evaluated.stdout).release_readiness, "forward-test-required");
});

test("P2 build credits skipped NEXT coverage only from evaluator-observed execution", async (t) => {
  const base = await makeTestDir("skipped-next-coverage");
  t.after(() => removeTestDir(base));
  const valid = join(base, "valid");
  await prepareSkippedNextPackage(valid);
  const built = await buildP2(valid, { repeats: 1 });
  assert.equal(built.fixtures.passed, 10);

  const missing = join(base, "missing-claim");
  await copyTree(valid, missing);
  const missingPath = join(missing, "fixtures", "scenarios.json");
  const missingScenarios = await readJson(missingPath);
  missingScenarios[0].cover = missingScenarios[0].cover.filter((claim) => claim !== "branch:preflight/skip");
  await writeJsonAtomic(missingPath, missingScenarios);
  const missingValidation = await validateFull(missing);
  assert.equal(missingValidation.ok, false);
  assert.ok(missingValidation.diagnostics.some((item) => item.code === "L14" && item.pointer === "STAGES.preflight.branches.skip"));

  const falseClaim = join(base, "false-claim");
  await copyTree(valid, falseClaim);
  const falsePath = join(falseClaim, "fixtures", "scenarios.json");
  const falseScenarios = await readJson(falsePath);
  const done = falseScenarios.find((fixture) => fixture.id === "done");
  done.cover.push("branch:preflight/skip");
  await writeJsonAtomic(falsePath, falseScenarios);
  await assert.rejects(runFixtureSuite(falseClaim, { repeats: 1 }), /Fixture done claims coverage it did not execute: branch:preflight\/skip/);
});

test("P2 missing guard inputs cannot earn coverage through a fixture-only execution path", async (t) => {
  const base = await makeTestDir("guard-input-parity");
  t.after(() => removeTestDir(base));
  const root = join(base, "skill");
  await copyTree(join(ROOT, "evals", "g0_5", "b-v5-clean"), root);

  const specPath = join(root, "spec.mjs");
  const source = await readFile(specPath, "utf8");
  await writeFile(specPath, source
    .replace("export const OBSERVATIONS = {", 'export const OBSERVATIONS = {\n  "guard.target": { decided: true, domain: ["block", "pass"] },')
    .replace("export const GUARDS = [", 'export const GUARDS = [\n  { id: "input-present", reads: ["guard.target"], when: s => s.guard.target === "block", then: "BLOCK", body: "guard: input-present" },'), "utf8");
  const bodyPath = join(root, "body.md");
  const body = await readFile(bodyPath, "utf8");
  await writeFile(bodyPath, body.replace("## guard: read-only-session", "## guard: input-present\n\nExplain why a current input is required before this guard can decide.\n\n## guard: read-only-session"), "utf8");

  const fixturesPath = join(root, "fixtures", "scenarios.json");
  const fixtures = await readJson(fixturesPath);
  for (const fixture of fixtures) fixture.decided = { ...(fixture.decided ?? {}), "guard.target": "pass" };
  const known = structuredClone(fixtures[0]);
  known.id = "guard-known";
  known.decided["guard.target"] = "block";
  known.expect = { guard: "input-present", stage: null, status: "BLOCK", effects: [] };
  known.cover = ["guard:input-present"];
  const missing = structuredClone(fixtures[0]);
  missing.id = "guard-missing";
  delete missing.decided["guard.target"];
  missing.expect = { guard: "input-present", stage: null, status: "BLOCK", effects: [] };
  missing.cover = [];
  fixtures.push(known, missing);
  await writeJsonAtomic(fixturesPath, fixtures);

  await buildP2(root, { repeats: 2 });
  const simulated = await simulateSkill({ skillRoot: root, fixture: missing, runtimeDir: join(root, "scripts", "skill-rails") });
  const live = await stageSkill({ skillRoot: root, projectRoot: base });
  for (const decision of [simulated.decision, live.decision]) {
    assert.equal(decision.status, "BLOCK");
    assert.equal(decision.guard.id, "input-present");
    assert.deepEqual(decision.needs.map(({ field }) => field), ["guard.target"]);
    assert.deepEqual(decision.effects, []);
  }

  missing.cover.push("guard:input-present");
  await writeJsonAtomic(fixturesPath, fixtures);
  await assert.rejects(runFixtureSuite(root, { repeats: 1 }), /Fixture guard-missing claims coverage it did not execute: guard:input-present/);
});

test("fixture materialization covers read-block guards and preserves mode-specific coverage claims", async (t) => {
  const base = await makeTestDir("fixture-unknown-coverage");
  t.after(() => removeTestDir(base));
  const root = join(base, "valid");
  await prepareUnknownReadPackage(root);
  const built = await buildP2(root, { repeats: 1 });
  assert.equal(built.fixtures.passed, 12);

  const fixturesPath = join(root, "fixtures", "scenarios.json");
  const fixtures = await readJson(fixturesPath);
  const runtimeDir = join(root, "scripts", "skill-rails");
  const missing = fixtures.find((fixture) => fixture.id === "missing-card-target");
  const simulated = await simulateSkill({ skillRoot: root, fixture: missing, runtimeDir });
  assert.equal(simulated.decision.status, "BLOCK");
  assert.equal(simulated.decision.guard.id, "card-target-required");
  assert.deepEqual(simulated.decision.needs.map(({ field }) => field), ["card.target"]);
  assert.deepEqual(simulated.decision.snapshot.unknowns, [{ field: "card.target", reason: "fixture-missing", details: "card.target" }]);

  const literal = fixtures.find((fixture) => fixture.id === "missing-card-target-literal");
  const literalSimulated = await simulateSkill({ skillRoot: root, fixture: literal, runtimeDir });
  assert.deepEqual(
    { status: literalSimulated.decision.status, guard: literalSimulated.decision.guard.id, needs: literalSimulated.decision.needs.map(({ field }) => field) },
    { status: simulated.decision.status, guard: simulated.decision.guard.id, needs: simulated.decision.needs.map(({ field }) => field) }
  );
  assert.deepEqual(literalSimulated.decision.snapshot.unknowns, [{ field: "card.target", reason: "unknown", details: null }]);

  const observedEvents = [];
  const observed = await simulateSkill({ skillRoot: root, fixture: missing, runtimeDir, evaluationObserver: (event) => observedEvents.push(event) });
  assert.deepEqual(observed.decision, simulated.decision);
  assert.deepEqual(observedEvents, [{ type: "guard_matched", data: { guard: "card-target-required", then: "BLOCK", pending_reads: ["card.target"] } }]);

  const falseClaim = join(base, "false-claim");
  await copyTree(root, falseClaim);
  const falseFixtures = await readJson(join(falseClaim, "fixtures", "scenarios.json"));
  falseFixtures.find((fixture) => fixture.id === "done").cover.push("guard:card-target-required");
  await writeJsonAtomic(join(falseClaim, "fixtures", "scenarios.json"), falseFixtures);
  await assert.rejects(runFixtureSuite(falseClaim, { repeats: 1 }), /Fixture done claims coverage it did not execute: guard:card-target-required/);

  const pending = join(base, "pending-guard");
  await copyTree(root, pending);
  const pendingFixtures = await readJson(join(pending, "fixtures", "scenarios.json"));
  const pendingReadOnly = pendingFixtures.find((fixture) => fixture.id === "read-only");
  delete pendingReadOnly.s["session.readOnly"];
  delete pendingReadOnly.expect.stage;
  pendingReadOnly.cover = ["guard-pending:read-only-session"];
  await writeJsonAtomic(join(pending, "fixtures", "scenarios.json"), pendingFixtures);
  const pendingValidation = await validateFull(pending);
  assert.equal(pendingValidation.ok, true, JSON.stringify(pendingValidation.diagnostics));
  const pendingResult = await runFixtureSuite(pending, { repeats: 1 });
  assert.equal(pendingResult.passed, 12);
  const pendingDecision = await simulateSkill({ skillRoot: pending, fixture: pendingReadOnly, runtimeDir: join(pending, "scripts", "skill-rails") });
  assert.deepEqual(pendingDecision.decision.needs.map(({ field }) => field), ["session.readOnly"]);

  const pendingFalseClaim = join(base, "pending-false-claim");
  await copyTree(pending, pendingFalseClaim);
  const pendingFalseFixtures = await readJson(join(pendingFalseClaim, "fixtures", "scenarios.json"));
  pendingFalseFixtures.find((fixture) => fixture.id === "read-only").cover = ["guard:read-only-session"];
  await writeJsonAtomic(join(pendingFalseClaim, "fixtures", "scenarios.json"), pendingFalseFixtures);
  await assert.rejects(runFixtureSuite(pendingFalseClaim, { repeats: 1 }), /Fixture read-only claims coverage it did not execute: guard:read-only-session/);

  const matchedFalseClaim = join(base, "matched-false-claim");
  await copyTree(root, matchedFalseClaim);
  const matchedFalseFixtures = await readJson(join(matchedFalseClaim, "fixtures", "scenarios.json"));
  matchedFalseFixtures.find((fixture) => fixture.id === "read-only").cover = ["guard-pending:read-only-session"];
  await writeJsonAtomic(join(matchedFalseClaim, "fixtures", "scenarios.json"), matchedFalseFixtures);
  await assert.rejects(runFixtureSuite(matchedFalseClaim, { repeats: 1 }), /Fixture read-only claims coverage it did not execute: guard-pending:read-only-session/);

  const knownFalseClaim = join(base, "known-false-claim");
  await copyTree(root, knownFalseClaim);
  const knownFalseFixtures = await readJson(join(knownFalseClaim, "fixtures", "scenarios.json"));
  knownFalseFixtures.find((fixture) => fixture.id === "signal-open").cover.push("guard:read-only-session");
  await writeJsonAtomic(join(knownFalseClaim, "fixtures", "scenarios.json"), knownFalseFixtures);
  await assert.rejects(runFixtureSuite(knownFalseClaim, { repeats: 1 }), /Fixture signal-open claims coverage it did not execute: guard:read-only-session/);
});

test("P2 build fuzzes exact formats across structured values", async (t) => {
  const base = await makeTestDir("format-fuzz");
  t.after(() => removeTestDir(base));
  const root = join(base, "skill");
  await copyTree(join(ROOT, "evals", "g0_5", "b-v5-clean"), root);
  const result = await buildP2(root, { repeats: 2 });
  assert.equal(result.manifest.evidence.formats.passed, 1);
  assert.equal(result.manifest.evidence.formats.results[0].round_trips, 256);
  assert.equal(result.manifest.evidence.formats.results[0].crlf_rejected, true);
});

test("table precedence and format completeness have independent golden witnesses", async (t) => {
  const base = await makeTestDir("semantic-witnesses");
  t.after(() => removeTestDir(base));
  const root = join(base, "skill");
  await copyTree(join(ROOT, "evals", "g0_5", "b-v5-clean"), root);
  await buildP2(root, { repeats: 2 });
  const specPath = join(root, "spec.mjs");
  const original = await readFile(specPath, "utf8");
  const broken = original.match(/    \{ state: "broken-record"[^\n]+\n/)?.[0];
  const open = original.match(/    \{ state: "open"[^\n]+\n/)?.[0];
  assert.ok(broken && open);
  await writeFile(specPath, original.replace(broken, "__ROW_SWAP__\n").replace(open, broken).replace("__ROW_SWAP__\n", open), "utf8");
  let validation = await validateFull(root);
  assert.ok(validation.diagnostics.some((item) => item.code === "L14" && /Expected row=broken-record, got open/.test(item.message)));
  await writeFile(specPath, original.replace(', "detail-json": "json"', ""), "utf8");
  validation = await validateFull(root);
  assert.ok(validation.diagnostics.some((item) => item.code === "L15" && /Golden values/.test(item.message)));
});

test("L5 exclusive-table checks use normalized fixture UNKNOWN values", async (t) => {
  const base = await makeTestDir("fixture-unknown-table");
  t.after(() => removeTestDir(base));
  const root = join(base, "skill");
  await copyTree(join(ROOT, "evals", "g0_5", "b-v5-clean"), root);
  const specPath = join(root, "spec.mjs");
  const source = await readFile(specPath, "utf8");
  const updated = source
    .replace("review: { exclusive: false, rows:", "review: { exclusive: true, rows:")
    .replace('{ state: "open", reads: ["review.lastVerdict", "review.lastTarget"],', '{ state: "open", reads: ["review.lastVerdict", "review.lastTarget", "review.ordinal"],')
    .replace(
      'when: s => s.review.lastVerdict === "finding" && s.review.lastTarget === "code" },',
      'when: s => s.review.lastVerdict === "finding" && s.review.lastTarget === "code" && s.review.ordinal < 3 },'
    );
  assert.notEqual(updated, source);
  await writeTextAtomic(specPath, updated);
  const scenarios = await readJson(join(root, "fixtures", "scenarios.json"));
  const sourceFixture = scenarios.find((fixture) => fixture.id === "unclassified");
  scenarios.push({
    id: "unknown-table-value",
    s: { ...sourceFixture.s, "review.lastVerdict": "UNKNOWN" },
    expect: { stage: "review", row: null, status: "BLOCK" },
    cover: []
  });
  await writeJsonAtomic(join(root, "fixtures", "scenarios.json"), scenarios);
  await buildP2(root, { repeats: 1 });
  const validation = await validateFull(root);
  assert.equal(validation.ok, true, JSON.stringify(validation.diagnostics));
  assert.equal(validation.diagnostics.some((item) => item.code === "L5"), false, JSON.stringify(validation.diagnostics));
});

test("non-ASCII package paths remain read-only during runtime evaluation", async (t) => {
  const base = await makeTestDir("unicode");
  t.after(() => removeTestDir(base));
  const root = join(base, "한글 경로", "skill");
  const intent = await readJson(join(ROOT, "fixtures", "intents", "p2.json"));
  await generatePackage({ intent, output: root, finalize: async (stage) => buildP2(stage, { repeats: 3 }) });
  await completeGeneratedP2ForRuntimeTest(root);
  await buildP2(root, { repeats: 1 });
  const before = await treeHashes(root);
  const result = await stageSkill({ skillRoot: root, projectRoot: ROOT, decided: { "authoring.readiness": "ready" } });
  assert.equal(result.decision.status, "DONE");
  assert.deepEqual(await treeHashes(root), before);
});

test("generation rolls back the target when final validation fails", async (t) => {
  const base = await makeTestDir("rollback");
  t.after(() => removeTestDir(base));
  const target = join(base, "failed");
  const intent = await readJson(join(ROOT, "fixtures", "intents", "p2.json"));
  await assert.rejects(generatePackage({ intent, output: target, finalize: async () => { throw new Error("injected-finalize-failure"); } }), /injected-finalize-failure/);
  assert.equal(await exists(target), false);
});

test("direct P2 rebuild validates in isolation and leaves generated outputs unchanged on failure", async (t) => {
  const base = await makeTestDir("rebuild-rollback");
  t.after(() => removeTestDir(base));
  const root = join(base, "skill");
  const intent = await readJson(join(ROOT, "fixtures", "intents", "p2.json"));
  await generatePackage({ intent, output: root, finalize: async (stage) => buildP2(stage, { repeats: 2 }) });
  const generated = [".gitattributes", "SKILL.md", "agents/openai.yaml", "schemas/decision.schema.json", "scripts/skill-rails/run.mjs", ".generated.json"];
  const before = Object.fromEntries(await Promise.all(generated.map(async (local) => [local, await hashFile(join(root, ...local.split("/")))])));
  const intentPath = join(root, ".skill-rails", "intent.json");
  const changedIntent = JSON.parse(await readFile(intentPath, "utf8"));
  changedIntent.description = "This text would change generated bootstrap output if a failed build leaked.";
  await writeFile(intentPath, JSON.stringify(changedIntent, null, 2), "utf8");
  await appendFile(join(root, "spec.mjs"), "\nprocess.cwd();\n", "utf8");
  await assert.rejects(buildP2(root, { repeats: 2 }), /L-full failed|L-fast|L0|L1/);
  const after = Object.fromEntries(await Promise.all(generated.map(async (local) => [local, await hashFile(join(root, ...local.split("/")))])));
  assert.deepEqual(after, before);
});

test("repeated P2 builds are byte-stable for every generated output", async (t) => {
  const base = await makeTestDir("reproducible-build");
  t.after(() => removeTestDir(base));
  const root = join(base, "skill");
  const intent = await readJson(join(ROOT, "fixtures", "intents", "p2.json"));
  await generatePackage({ intent, output: root, finalize: async (stage) => buildP2(stage, { repeats: 3 }) });
  const firstManifest = await readJson(join(root, ".generated.json"));
  const paths = [...Object.keys(firstManifest.generated_files), ".generated.json"].sort();
  const before = Object.fromEntries(await Promise.all(paths.map(async (local) => [local, await hashFile(join(root, ...local.split("/")))])));
  await buildP2(root, { repeats: 3 });
  const after = Object.fromEntries(await Promise.all(paths.map(async (local) => [local, await hashFile(join(root, ...local.split("/")))])));
  assert.deepEqual(after, before);
});

test("P2 package attributes collide safely and transfer ownership only when explicit", async (t) => {
  const base = await makeTestDir("package-attributes-collision");
  t.after(() => removeTestDir(base));
  const intent = await readJson(join(ROOT, "fixtures", "intents", "p2.json"));

  const noncanonical = join(base, "noncanonical");
  await generatePackage({ intent, output: noncanonical });
  await writeFile(join(noncanonical, ".gitattributes"), "*.mjs text\n", "utf8");
  const noncanonicalBefore = await treeHashes(noncanonical);
  await assert.rejects(buildP2(noncanonical, { allowGeneratedEdits: true, repeats: 1 }), (error) => error.code === "SR_GENERATED_COLLISION" && /not overwritten or merged/.test(error.message));
  assert.deepEqual(await treeHashes(noncanonical), noncanonicalBefore);

  const transferable = join(base, "transferable");
  await generatePackage({ intent, output: transferable });
  await writeFile(join(transferable, ".gitattributes"), P2_PACKAGE_GITATTRIBUTES, "utf8");
  const transferableBefore = await treeHashes(transferable);
  await assert.rejects(buildP2(transferable, { repeats: 1 }), (error) => error.code === "SR_GENERATED_COLLISION" && /--repair-generated/.test(error.message));
  assert.deepEqual(await treeHashes(transferable), transferableBefore);
  await buildP2(transferable, { allowGeneratedEdits: true, repeats: 1 });
  const manifest = await readJson(join(transferable, ".generated.json"));
  assert.equal(await readFile(join(transferable, ".gitattributes"), "utf8"), P2_PACKAGE_GITATTRIBUTES);
  assert.match(manifest.generated_files[".gitattributes"], /^sha256:[0-9a-f]{64}$/);
});

test("manifest rejects every generated-surface class and L-fast rejects spec mutation", async (t) => {
  const base = await makeTestDir("tamper");
  t.after(() => removeTestDir(base));
  const root = join(base, "skill");
  const intent = await readJson(join(ROOT, "fixtures", "intents", "p2.json"));
  await generatePackage({ intent, output: root, finalize: async (stage) => buildP2(stage, { repeats: 3 }) });
  const candidates = [
    ".gitattributes",
    "scripts/skill-rails/alignment.mjs", "scripts/skill-rails/api.mjs", "scripts/skill-rails/body.mjs",
    "scripts/skill-rails/collectors.mjs", "scripts/skill-rails/constants.mjs", "scripts/skill-rails/domains.mjs",
    "scripts/skill-rails/evaluator.mjs", "scripts/skill-rails/guide.mjs", "scripts/skill-rails/loader.mjs",
    "scripts/skill-rails/snapshot.mjs", "scripts/skill-rails/run.mjs",
    "scripts/skill-rails/vendor/ACORN-LICENSE", "schemas/decision.schema.json", "agents/openai.yaml",
    "fixtures/scenarios.json", ".skill-rails/intent.json"
  ];
  const rejected = [];
  for (const [index, local] of candidates.entries()) {
    const path = join(root, ...local.split("/"));
    const original = await readFile(path, "utf8");
    await writeFile(path, `${original}\n// tamper-${index}\n`, "utf8");
    try { await loadBuiltSkill(root); }
    catch (error) { assert.equal(error.code, "SR_MANIFEST_MISMATCH"); rejected.push(local); }
    finally { await writeFile(path, original, "utf8"); }
  }
  assert.deepEqual(rejected, candidates);

  const manifestPath = join(root, ".generated.json");
  const originalManifest = await readFile(manifestPath, "utf8");
  const changedManifest = JSON.parse(originalManifest);
  changedManifest.build_id = "sha256:" + "0".repeat(64);
  await writeFile(manifestPath, JSON.stringify(changedManifest), "utf8");
  await assert.rejects(loadBuiltSkill(root), (error) => error.code === "SR_MANIFEST_MISMATCH");
  await writeFile(manifestPath, originalManifest, "utf8");

  const unsupportedNodeManifest = JSON.parse(originalManifest);
  unsupportedNodeManifest.minimum_node_major = Number(process.versions.node.split(".")[0]) + 1;
  await writeFile(manifestPath, JSON.stringify(unsupportedNodeManifest), "utf8");
  await assert.rejects(loadBuiltSkill(root), (error) => error.code === "SR_NODE_VERSION");
  await writeFile(manifestPath, originalManifest, "utf8");

  const unsafeManifest = JSON.parse(originalManifest);
  unsafeManifest.generated_files["../outside.txt"] = "sha256:" + "0".repeat(64);
  await writeFile(manifestPath, JSON.stringify(unsafeManifest), "utf8");
  await assert.rejects(buildP2(root, { repeats: 1 }), /unsafe-path/);
  await writeFile(manifestPath, originalManifest, "utf8");

  const specPath = join(root, "spec.mjs");
  const spec = await readFile(specPath, "utf8");
  await writeFile(specPath, `${spec}\nprocess.cwd();\n`, "utf8");
  await assert.rejects(loadBuiltSkill(root), (error) => error.code === "SR_LFAST_FAILED");
  await writeFile(specPath, spec, "utf8");

  const generated = join(root, "scripts", "skill-rails", "run.mjs");
  const originalGenerated = await readFile(generated, "utf8");
  await appendFile(generated, "// manual edit\n", "utf8");
  await assert.rejects(buildP2(root, { repeats: 1 }), /edited manually/);
  await writeFile(generated, originalGenerated, "utf8");
});

test("trace state stays external and alignment distinguishes observed evidence", async (t) => {
  const base = await makeTestDir("trace");
  t.after(() => removeTestDir(base));
  const root = join(base, "skill");
  const traceDir = join(base, "state", "traces");
  const intent = await readJson(join(ROOT, "fixtures", "intents", "p2.json"));
  await generatePackage({ intent, output: root, finalize: async (stage) => buildP2(stage, { repeats: 3 }) });
  await completeGeneratedP2ForRuntimeTest(root);
  await buildP2(root, { repeats: 1 });
  await assert.rejects(assertExternalStateDir(root, join(root, ".state")), (error) => error.code === "SR_STATE_INSIDE_SKILL");
  await assertExternalStateDir(root, traceDir);
  const inside = join(root, "inside-target"); const outside = join(base, "outside-target");
  await Promise.all([mkdir(inside, { recursive: true }), mkdir(outside, { recursive: true })]);
  try {
    const outsideLink = join(base, "outside-link-to-inside");
    const insideLink = join(root, "inside-link-to-outside");
    await symlink(inside, outsideLink, "junction");
    await symlink(outside, insideLink, "junction");
    await assert.rejects(assertExternalStateDir(root, outsideLink), (error) => error.code === "SR_STATE_INSIDE_SKILL");
    await assert.rejects(assertExternalStateDir(root, insideLink), (error) => error.code === "SR_STATE_INSIDE_SKILL");
    await rm(outsideLink, { recursive: true, force: true });
    await rm(insideLink, { recursive: true, force: true });
  } catch (error) {
    if (!["EPERM", "EACCES", "UNKNOWN"].includes(error.code)) throw error;
  }

  const project = join(base, "project");
  await mkdir(project, { recursive: true });
  const staged = await stageSkill({ skillRoot: root, projectRoot: project, decided: { "authoring.readiness": "ready" }, traceDir, runId: "run-1" });
  const tracePath = join(traceDir, "run-1.jsonl");
  const decisionPath = join(base, "decision.json");
  await writeFile(decisionPath, JSON.stringify(staged.decision), "utf8");
  const quiet = { log() {}, error() {} };
  assert.equal(await runtimeMain(["record", "--skill", root, "--decision", decisionPath, "--trace-dir", traceDir, "--run-id", "run-1", "--type", "effect_claimed", "--unknown-probe", "true"], quiet), 1);
  assert.equal(await runtimeMain(["record", "--skill", root, "--decision", decisionPath, "--trace-dir", traceDir, "--run-id", "run-1", "--type", "effect_observed", "--authority", "harness_observed", "--data", '{"index":0,"verb":"REPORT"}'], quiet), 1);
  assert.equal(await runtimeMain(["record", "--skill", root, "--decision", decisionPath, "--trace-dir", traceDir, "--run-id", "run-1", "--type", "effect_observed", "--data", '{"index":0,"verb":"REPORT"}'], quiet), 1);
  let events = await readTrace(tracePath);
  assert.equal(alignDecision(staged.decision, events).aggregate, "unproven");
  await recordHarnessEvidence({ skillRoot: root, traceDir, runId: "run-1", decision: staged.decision, type: "effect_observed", data: { index: 0, verb: "REPORT", kind: "effect" } });
  events = await readTrace(tracePath);
  assert.equal(alignDecision(staged.decision, events).aggregate, "aligned");
});

test("snapshot changes during collection fail closed as stale", async (t) => {
  const base = await makeTestDir("stale");
  t.after(() => removeTestDir(base));
  const root = join(base, "skill"); const project = join(base, "project"); const traceDir = join(base, "trace");
  await mkdir(project, { recursive: true });
  const watched = join(project, "watched.txt"); await writeFile(watched, "before", "utf8");
  const intent = await readJson(join(ROOT, "fixtures", "intents", "p2.json"));
  await generatePackage({ intent, output: root, finalize: async (stage) => buildP2(stage, { repeats: 2 }) });
  await completeGeneratedP2ForRuntimeTest(root);
  const specPath = join(root, "spec.mjs");
  const spec = (await readFile(specPath, "utf8")).replace(
    '"authoring.readiness": { decided: true, domain: ["ready", "needs-design", "complete"] }',
    '"authoring.readiness": { decided: true, domain: ["ready", "needs-design", "complete"] },\n  "probe.value": { collector: "evidence-release/probe.value", domain: ["yes"] }'
  );
  await writeTextAtomic(specPath, spec);
  await writeTextAtomic(join(root, "collectors", "index.mjs"), 'import { readFile, writeFile } from "node:fs/promises";\nimport { join } from "node:path";\nexport const collectors = { "evidence-release/probe.value": async (ctx) => { await writeFile(join(ctx.projectRoot, "collector.started"), "yes", "utf8"); await new Promise((resolve) => setTimeout(resolve, 80)); return "yes"; } };\nexport const snapshotBasis = async (ctx) => ({ watched: await readFile(join(ctx.projectRoot, "watched.txt"), "utf8") });\n');
  await buildP2(root, { repeats: 2 });
  const stagedPromise = stageSkill({ skillRoot: root, projectRoot: project, targetPath: "./watched.txt", decided: { "authoring.readiness": "ready" }, traceDir, runId: "stale-run" });
  const collectorStarted = join(project, "collector.started");
  for (let attempt = 0; attempt < 100 && !(await exists(collectorStarted)); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(await exists(collectorStarted), true);
  await writeFile(watched, "after-and-longer", "utf8");
  const staged = await stagedPromise;
  assert.equal(staged.decision.snapshot.status, "stale");
  assert.equal(staged.decision.status, "BLOCK");
  assert.equal(staged.decision.reinvoke, "recompute");
  const staleEvents = await readTrace(join(traceDir, "stale-run.jsonl"));
  assert.ok(staleEvents.some((event) => event.type === "snapshot_stale"));
  assert.equal(staleEvents.findLast((event) => event.type === "decision_emitted").data.targetPath, "watched.txt");
});

test("public stage target is normalized, collector-owned, optional, and containment-safe across API and CLI", async (t) => {
  const base = await makeTestDir("stage-target");
  t.after(() => removeTestDir(base));
  const root = join(base, "skill");
  const project = join(base, "project");
  const outside = join(base, "outside");
  await Promise.all([mkdir(join(project, "cards"), { recursive: true }), mkdir(outside, { recursive: true })]);
  await writeFile(join(project, "cards", "task.md"), "selected task\n", "utf8");
  await writeFile(join(project, "cards", "task two.md"), "second selected task\n", "utf8");
  await writeFile(join(outside, "task.md"), "outside task\n", "utf8");

  const intent = await readJson(join(ROOT, "fixtures", "intents", "p2.json"));
  await generatePackage({ intent, output: root, finalize: async (stage) => buildP2(stage, { repeats: 1 }) });
  const deferredTraceDir = join(base, "deferred-traces");
  const deferredTarget = await stageSkill({ skillRoot: root, projectRoot: project, targetPath: "cards//./task.md", traceDir: deferredTraceDir, runId: "deferred-target" });
  assert.equal(deferredTarget.decision.guard.id, "authoring-deferred");
  assert.equal((await readTrace(deferredTarget.tracePath)).findLast((event) => event.type === "decision_emitted").data.targetPath, "cards/task.md");
  await completeGeneratedP2ForRuntimeTest(root);
  const specPath = join(root, "spec.mjs");
  const originalSpec = await readFile(specPath, "utf8");
  const targetSpec = originalSpec
    .replace(
      '"authoring.readiness": { decided: true, domain: ["ready", "needs-design", "complete"] }',
      '"authoring.readiness": { decided: true, domain: ["ready", "needs-design", "complete"] },\n  "input.target": { collector: "evidence-release/input.target", domain: "path|NONE" }'
    )
    .replace('reads: ["authoring.readiness"]', 'reads: ["authoring.readiness", "input.target"]')
    .replace('done: s => s.authoring.readiness === "complete"', 'done: s => s.authoring.readiness === "complete" && s.input.target === "NONE"')
    .replace('"needs-design": ["BLOCK"]', '"needs-design": ["BLOCK"],\n    complete: ["DONE"]');
  assert.notEqual(targetSpec, originalSpec);
  await writeTextAtomic(specPath, targetSpec);
  await writeTextAtomic(join(root, "collectors", "index.mjs"), `import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const collectors = Object.freeze({
  "evidence-release/input.target": async (ctx) => Object.hasOwn(ctx, "targetPath") ? ctx.targetPath : "NONE"
});

export const snapshotBasis = async (ctx) => Object.hasOwn(ctx, "targetPath")
  ? { targetPath: ctx.targetPath, content: await readFile(join(ctx.projectRoot, ...ctx.targetPath.split("/")), "utf8") }
  : { legacyContext: true };
`);
  const scenariosPath = join(root, "fixtures", "scenarios.json");
  const scenarios = await readJson(scenariosPath);
  for (const scenario of scenarios) scenario.s = { ...(scenario.s ?? {}), "input.target": "NONE" };
  const completeScenario = scenarios.find((scenario) => scenario.id === "complete");
  completeScenario.s["input.target"] = "cards/task.md";
  completeScenario.expect = { stage: "operate", status: "DONE", effects: ["DONE"] };
  completeScenario.cover = ["branch:operate/complete"];
  await writeJsonAtomic(scenariosPath, scenarios);
  await buildP2(root, { repeats: 1 });

  const decided = { "authoring.readiness": "ready" };
  const stageCli = ["stage", "--skill", root, "--runtime-dir", join(root, "scripts", "skill-rails"), "--project", project];
  const apiTarget = await stageSkill({ skillRoot: root, projectRoot: project, targetPath: "cards//./task.md", decided });
  assert.equal(apiTarget.decision.facts.find((item) => item.field === "input.target").value, "cards/task.md");

  const cliTargetIo = captureIo();
  const cliTargetStatus = await runtimeMain([...stageCli, "--target", "cards/./task.md", "--decided", "authoring.readiness=ready", "--json"], cliTargetIo);
  assert.equal(cliTargetStatus, 0, JSON.stringify(cliTargetIo.errors));
  const cliTarget = JSON.parse(cliTargetIo.logs.at(-1));
  assert.deepEqual(cliTarget.decision, apiTarget.decision);
  assert.deepEqual(cliTargetIo.errors, []);

  const apiAbsent = await stageSkill({ skillRoot: root, projectRoot: project, decided });
  assert.equal(apiAbsent.decision.facts.find((item) => item.field === "input.target").value, "NONE");
  assert.notEqual(apiAbsent.decision.snapshot.fingerprint, apiTarget.decision.snapshot.fingerprint);
  const cliAbsentIo = captureIo();
  assert.equal(await runtimeMain([...stageCli, "--decided", "authoring.readiness=ready", "--json"], cliAbsentIo), 0);
  assert.deepEqual(JSON.parse(cliAbsentIo.logs.at(-1)).decision, apiAbsent.decision);

  const traceDir = join(base, "traces");
  const tracedTarget = await stageSkill({ skillRoot: root, projectRoot: project, targetPath: "cards//./task two.md", decided, traceDir, runId: "target-bearing" });
  const targetEmission = (await readTrace(tracedTarget.tracePath)).findLast((event) => event.type === "decision_emitted");
  assert.equal(targetEmission.data.targetPath, "cards/task two.md");
  const targetResumeIo = captureIo();
  assert.equal(await runtimeMain(["resume", "--skill", root, "--runtime-dir", join(root, "scripts", "skill-rails"), "--trace", tracedTarget.tracePath, "--project", project, "--json"], targetResumeIo), 0);
  const targetResume = JSON.parse(targetResumeIo.logs.at(-1));
  assert.equal(targetResume.next_command.endsWith(' --target "cards/task two.md"'), true);

  const tracedAbsent = await stageSkill({ skillRoot: root, projectRoot: project, decided, traceDir, runId: "target-absent" });
  const absentEmission = (await readTrace(tracedAbsent.tracePath)).findLast((event) => event.type === "decision_emitted");
  assert.equal(Object.hasOwn(absentEmission.data, "targetPath"), false);
  assert.equal(JSON.stringify(absentEmission.data), JSON.stringify({ status: tracedAbsent.decision.status, stage: tracedAbsent.decision.stage, row: tracedAbsent.decision.row, decision: tracedAbsent.decision }));
  const absentResumeIo = captureIo();
  assert.equal(await runtimeMain(["resume", "--skill", root, "--runtime-dir", join(root, "scripts", "skill-rails"), "--trace", tracedAbsent.tracePath, "--project", project, "--json"], absentResumeIo), 0);
  assert.equal(JSON.parse(absentResumeIo.logs.at(-1)).next_command.includes(" --target "), false);

  const invalidTargets = [join(project, "cards", "task.md"), "cards/../task.md", 42];
  for (const targetPath of invalidTargets) {
    await assert.rejects(stageSkill({ skillRoot: root, projectRoot: project, targetPath, decided }), (error) => error.code === "SR_STAGE_TARGET");
    if (typeof targetPath === "string") {
      const io = captureIo();
      assert.equal(await runtimeMain([...stageCli, "--target", targetPath, "--decided", "authoring.readiness=ready", "--json"], io), 1);
      assert.equal(JSON.parse(io.errors.at(-1)).diagnostic.code, "SR_STAGE_TARGET");
    }
  }

  try {
    await symlink(outside, join(project, "outside-link"), process.platform === "win32" ? "junction" : "dir");
    await assert.rejects(stageSkill({ skillRoot: root, projectRoot: project, targetPath: "outside-link/task.md", decided }), (error) => error.code === "SR_STAGE_TARGET");
    const io = captureIo();
    assert.equal(await runtimeMain([...stageCli, "--target", "outside-link/task.md", "--decided", "authoring.readiness=ready", "--json"], io), 1);
    assert.equal(JSON.parse(io.errors.at(-1)).diagnostic.code, "SR_STAGE_TARGET");
    t.diagnostic(`${process.platform === "win32" ? "junction" : "symlink"} target escape was rejected by API and CLI`);
  } catch (error) {
    if (!["EPERM", "EACCES", "UNKNOWN"].includes(error.code)) throw error;
    t.diagnostic(`target link creation unavailable: ${error.code}`);
  }
});

test("non-git snapshot fallback hashes nested same-size content changes", async (t) => {
  const base = await makeTestDir("filesystem-snapshot");
  t.after(() => removeTestDir(base));
  const project = join(base, "project");
  await mkdir(join(project, "nested"), { recursive: true });
  await writeFile(join(project, ".git"), "gitdir: .git-missing\n", "utf8");
  const watched = join(project, "nested", "watched.txt");
  await writeFile(watched, "AAAA", "utf8");
  const before = await captureSnapshot(project);
  assert.equal(before.material.kind, "filesystem");
  await writeFile(watched, "BBBB", "utf8");
  const after = await captureSnapshot(project);
  assert.notEqual(after.fingerprint, before.fingerprint);
  assert.equal(after.material.entries.find((entry) => entry.path === "nested/watched.txt").size, 4);
});

test("template and READ_FIRST paths fail closed on traversal and junction escape", async (t) => {
  const base = await makeTestDir("path-policy");
  t.after(() => removeTestDir(base));
  const root = join(base, "skill");
  const outside = join(base, "outside");
  await Promise.all([mkdir(join(root, "templates"), { recursive: true }), mkdir(outside, { recursive: true })]);
  await writeFile(join(outside, "secret.md"), "outside\n", "utf8");
  await assert.rejects(resolveTemplate(root, "escape", { file: "../outside/secret.md" }), (error) => error.code === "L11");

  try {
    await symlink(outside, join(root, "templates", "linked"), "junction");
    await assert.rejects(resolveTemplate(root, "escape", { file: "templates/linked/secret.md" }), (error) => error.code === "L11");

    const generated = join(base, "generated");
    const intent = await readJson(join(ROOT, "fixtures", "intents", "p2.json"));
    await generatePackage({ intent, output: generated, finalize: async (stage) => buildP2(stage, { repeats: 2 }) });
    const externalLink = join(generated, "references", "external");
    await symlink(outside, externalLink, "junction");
    const specPath = join(generated, "spec.mjs");
    const source = (await readFile(specPath, "utf8")).replace('{ body: "why: purpose" }', '{ body: "why: purpose", path: "references/external/secret.md" }');
    await writeFile(specPath, source, "utf8");
    await assert.rejects(buildP2(generated, { repeats: 2 }), (error) => error.code === "SR_PACKAGE_SYMLINK");
  } catch (error) {
    if (!["EPERM", "EACCES", "UNKNOWN"].includes(error.code)) throw error;
  }
});

test("trace records only predicates actually evaluated and orders projection before emission", async (t) => {
  const base = await makeTestDir("trace-order");
  t.after(() => removeTestDir(base));
  const root = join(base, "skill");
  const traceDir = join(base, "traces");
  const intent = await readJson(join(ROOT, "fixtures", "intents", "p2.json"));
  await generatePackage({ intent, output: root, finalize: async (stage) => buildP2(stage, { repeats: 2 }) });
  await completeGeneratedP2ForRuntimeTest(root);
  const specPath = join(root, "spec.mjs");
  const source = (await readFile(specPath, "utf8"))
    .replace(
      '"authoring.readiness": { decided: true, domain: ["ready", "needs-design", "complete"] }',
      '"authoring.readiness": { decided: true, domain: ["ready", "needs-design", "complete"] },\n  "guard.known": { decided: true, domain: ["yes", "no"] },\n  "guard.missing": { decided: true, domain: ["yes", "no"] }'
    )
    .replace("export const GUARDS = [];", 'export const GUARDS = [\n  { id: "known-false", reads: ["guard.known"], when: s => s.guard.known === "yes", then: "BLOCK", body: "guard: known-false" },\n  { id: "missing-input", reads: ["guard.known", "guard.missing"], when: s => s.guard.known === "no" && s.guard.missing === "yes", then: "BLOCK", body: "guard: missing-input" }\n];');
  await writeFile(specPath, source, "utf8");
  const bodyPath = join(root, "body.md");
  const body = await readFile(bodyPath, "utf8");
  await writeFile(bodyPath, body.replace("## stage: operate", "## guard: known-false\n\nBlock when the known guard is yes.\n\n## guard: missing-input\n\nBlock when the second guard is yes.\n\n## stage: operate"), "utf8");
  const fixturesPath = join(root, "fixtures", "scenarios.json");
  const fixtures = JSON.parse(await readFile(fixturesPath, "utf8"));
  for (const fixture of fixtures) fixture.decided = { ...(fixture.decided ?? {}), "guard.known": "no", "guard.missing": "no" };
  fixtures.push(
    { id: "guard-known", s: {}, decided: { "authoring.readiness": "ready", "guard.known": "yes", "guard.missing": "no" }, expect: { guard: "known-false", stage: null, status: "BLOCK" }, cover: ["guard:known-false"] },
    { id: "guard-missing", s: {}, decided: { "authoring.readiness": "ready", "guard.known": "no", "guard.missing": "yes" }, expect: { guard: "missing-input", stage: null, status: "BLOCK" }, cover: ["guard:missing-input"] }
  );
  await writeFile(fixturesPath, JSON.stringify(fixtures, null, 2), "utf8");
  await buildP2(root, { repeats: 2 });
  const project = join(base, "project");
  await mkdir(project, { recursive: true });
  const staged = await stageSkill({
    skillRoot: root, projectRoot: project, traceDir, runId: "trace-order",
    decided: { "authoring.readiness": "ready", "guard.known": "no" }
  });
  assert.equal(staged.decision.status, "BLOCK");
  assert.equal(staged.decision.guard.id, "missing-input");
  assert.deepEqual(staged.decision.needs.map(({ field }) => field), ["guard.missing"]);
  const events = (await readTrace(join(traceDir, "trace-order.jsonl"))).filter((event) => event.decision_id === staged.decision.decision_id);
  assert.deepEqual(events.filter((event) => event.type === "guard_evaluated").map((event) => event.data.guard), ["known-false"]);
  assert.deepEqual(events.filter((event) => event.type === "guard_matched").map((event) => event.data), [{ guard: "missing-input", then: "BLOCK", pending_reads: ["guard.missing"] }]);
  const types = events.map((event) => event.type);
  assert.ok(types.indexOf("guard_matched") < types.indexOf("review_required"));
  assert.ok(types.indexOf("review_required") < types.indexOf("decision_emitted"));
  assert.ok(types.indexOf("decision_emitted") < types.indexOf("guide_rendered"));
});

async function treeHashes(root) {
  const output = {};
  for (const path of await listFiles(root, { exclude: [".skill-rails"] })) output[path.slice(root.length + 1).replace(/\\/g, "/")] = await hashFile(path);
  return output;
}

function captureIo() {
  const logs = [];
  const errors = [];
  return { logs, errors, log(value) { logs.push(value); }, error(value) { errors.push(value); } };
}

async function prepareSkippedNextPackage(root) {
  await copyTree(join(ROOT, "evals", "g0_5", "b-v5-clean"), root);
  const specPath = join(root, "spec.mjs");
  const source = await readFile(specPath, "utf8");
  assert.match(source, /export const OBSERVATIONS = \{/);
  assert.match(source, /export const STAGES = \[/);
  await writeFile(specPath, source
    .replace("export const OBSERVATIONS = {", 'export const OBSERVATIONS = {\n  "route.mode": { decided: true, domain: ["skip"] },')
    .replace("export const STAGES = [", 'export const STAGES = [\n  { id: "preflight", reads: ["signal.pass"], done: s => s.signal.pass === "yes", needs: ["route.mode"], reentry: "rejudge", branches: { skip: ["NEXT"] }, body: "stage: preflight" },'), "utf8");

  const bodyPath = join(root, "body.md");
  const body = await readFile(bodyPath, "utf8");
  await writeFile(bodyPath, body.replace("## stage: signal", "## stage: preflight\n\nJudgment: Treat route.mode value skip as the no-effect branch.\n\nWhy: Coverage must prove the branch that actually yielded.\n\n## stage: signal"), "utf8");

  const scenariosPath = join(root, "fixtures", "scenarios.json");
  const scenarios = await readJson(scenariosPath);
  for (const fixture of scenarios) fixture.decided = { ...(fixture.decided ?? {}), "route.mode": "skip" };
  scenarios[0].cover.unshift("stage:preflight", "branch:preflight/skip");
  await writeJsonAtomic(scenariosPath, scenarios);
}

async function prepareUnknownReadPackage(root) {
  await copyTree(join(ROOT, "evals", "g0_5", "b-v5-clean"), root);
  const specPath = join(root, "spec.mjs");
  const source = await readFile(specPath, "utf8");
  const updated = source
    .replace("export const OBSERVATIONS = {", 'export const OBSERVATIONS = {\n  "card.target": { decided: true, domain: "path" },')
    .replace("export const GUARDS = [", 'export const GUARDS = [\n  { id: "card-target-required", reads: ["card.target"], when: s => !s.card.target, then: "BLOCK", body: "guard: card-target-required" },');
  assert.notEqual(updated, source);
  await writeTextAtomic(specPath, updated);

  const bodyPath = join(root, "body.md");
  const body = await readFile(bodyPath, "utf8");
  await writeTextAtomic(bodyPath, body.replace("## guard: read-only-session", "## guard: card-target-required\n\nBlock until the selected card target is observed.\n\n## guard: read-only-session"));

  const scenariosPath = join(root, "fixtures", "scenarios.json");
  const scenarios = await readJson(scenariosPath);
  for (const fixture of scenarios) fixture.decided = { ...(fixture.decided ?? {}), "card.target": "cards/task.md" };
  const missingDecided = { ...scenarios[0].decided };
  delete missingDecided["card.target"];
  scenarios.push({
    id: "missing-card-target",
    s: { ...scenarios[0].s },
    decided: missingDecided,
    expect: { status: "BLOCK", guard: "card-target-required" },
    cover: ["guard-pending:card-target-required"]
  });
  scenarios.push({
    id: "missing-card-target-literal",
    s: { ...scenarios[0].s },
    decided: { ...scenarios[0].decided, "card.target": "UNKNOWN" },
    expect: { status: "BLOCK", guard: "card-target-required" },
    cover: ["guard-pending:card-target-required"]
  });
  await writeJsonAtomic(scenariosPath, scenarios);
}

async function completeGeneratedP2ForRuntimeTest(root) {
  const path = join(root, "spec.mjs");
  const source = await readFile(path, "utf8");
  const completed = source.replace(/export const DEFERRED = \[[\s\S]*?\];\s*$/, "export const DEFERRED = [];\n");
  assert.notEqual(completed, source, "generated P2 test scaffold must contain a DEFERRED authoring gate");
  await writeTextAtomic(path, completed);
  const ledgerPath = join(root, ".skill-rails", "obligation-ledger.json");
  const ledger = await readJson(ledgerPath);
  for (const atom of ledger.atoms) if (atom.disposition === "review-required") {
    atom.disposition = "projected";
    atom.targets = ["spec:STAGES/operate"];
    atom.evidence = ["fixture:ready"];
  }
  await writeJsonAtomic(ledgerPath, ledger);
}
