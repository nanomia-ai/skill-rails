import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { generatePackage } from "../skills/skill-rails/scripts/lib/generator.mjs";
import {
  createMaintenanceContext,
  renderMaintenanceContextText,
  renderSkillMapPreview
} from "../skills/skill-rails/scripts/lib/maintenance-context.mjs";
import { exists, readJson } from "../skills/skill-rails/scripts/lib/io.mjs";
import { resolveSpecLocator } from "../skills/skill-rails/scripts/runtime/authoring-ledger.mjs";
import { validateAuthoringLedger } from "../skills/skill-rails/scripts/runtime/authoring-ledger.mjs";
import { sha256 } from "../skills/skill-rails/scripts/runtime/hash.mjs";
import { ROOT, SKILL_ROOT, makeTestDir, removeTestDir } from "./helpers.mjs";

const PILOT = join(ROOT, "fixtures", "next-core-single-skill-pilot", "skill");

test("describe projects one bounded P2 causal capsule from current source", async () => {
  const value = await createMaintenanceContext(PILOT, { query: "spec:STAGES/evidence" });
  const locators = new Set(value.capsule.subjects.map((subject) => subject.locator));
  const relationKeys = new Set(value.capsule.relations.map((relation) => `${relation.kind}:${relation.from_label}->${relation.to_label}`));

  assert.equal(value.snapshot.stable, true);
  assert.equal(value.query.status, "found");
  assert.equal(value.summary.extraction_status, "complete-for-declared-scope");
  assert.ok(locators.has("spec:STAGES/evidence"));
  assert.ok(locators.has("body:stage: evidence"));
  assert.ok(locators.has("spec:TABLES/evidence/matching-pass"));
  assert.ok(locators.has("spec:TABLES/evidence/BLOCK:evidence-unclassified"));
  assert.ok(locators.has("atom:state-dependent-behaviors-002"));
  assert.ok(locators.has("intent:state_dependent_behaviors[1]"));
  assert.ok(locators.has("fixture:evidence-unclassified"));
  assert.ok([...relationKeys].some((key) => /^selects-table:spec:STAGES\/evidence->spec\.mjs:/.test(key)));
  assert.ok(relationKeys.has("targets:atom:completion-evidence-001->spec:STAGES/evidence"));
  assert.ok(relationKeys.has("originates-from:atom:state-dependent-behaviors-002->intent:state_dependent_behaviors[1]"));
  assert.ok(relationKeys.has("declares-cover:fixture:evidence-unclassified->spec:TABLES/evidence/BLOCK:evidence-unclassified"));
  assert.equal(value.evidence.fresh_agent.status, "UNPROVEN-by-package-inventory");
  assert.equal(value.assessment.full_validation, "not-assessed-no-package-source-execution");
  assert.equal(value.assessment.relation_coverage.status, "closed");
  assert.ok(value.assessment.relation_coverage.required_families.outgoing.includes("uses-body"));
  assert.ok(value.next.change.length > 0);
  assert.ok(value.frontiers.some((item) => item.kind === "dynamic-collector-implementation"));
  assert.ok(value.capsule.subjects.every((subject) => !subject.path?.startsWith("scripts/skill-rails/")));
  assert.equal(value.index.catalog_complete_for_native_locators, false);
  assert.match(value.index.full_catalog_invocation, /--describe --json$/);
  assert.ok(JSON.stringify(value).length < 75_000, "the exact-stage result must remain usable as AI context");
  assert.ok(renderMaintenanceContextText(value).length < 40_000, "the human projection must remain bounded");
});

test("describe distinguishes finite absence from unknown", async () => {
  const absent = await createMaintenanceContext(PILOT, { query: "spec:ROLES/not-present" });
  assert.equal(absent.query.status, "absent-in-declared-scope");

  const malformed = await createMaintenanceContext(PILOT, { query: "spec:TABLES/evidence" });
  assert.equal(malformed.query.status, "unknown");
  assert.match(malformed.query.note, /valid accepted L16 spec locator shape/);

  const natural = await createMaintenanceContext(PILOT, { query: "phrase-that-is-not-in-this-package-7f25" });
  assert.equal(natural.query.status, "unknown");
  assert.match(natural.query.note, /never establishes absence/);
  assert.equal(natural.index.catalog_complete_for_native_locators, true);
  assert.equal(natural.inventory.catalog_complete, true);
});

test("natural queries bridge locator separators without hiding multiple matches", async () => {
  const value = await createMaintenanceContext(PILOT, { query: "completion evidence" });
  assert.equal(value.query.status, "found");
  assert.equal(value.query.match_basis, "case-insensitive separator-normalized substring");
  assert.deepEqual(value.query.matched_subjects.map((subject) => subject.locator), [
    "atom:completion-evidence-001",
    "intent:completion_evidence[0]"
  ]);
  assert.ok(value.capsule.subjects.some((subject) => subject.locator === "spec:STAGES/evidence"));
  assert.equal(value.index.catalog_complete_for_native_locators, false);
  assert.ok(value.index.provided_locator_count < value.index.native_locator_count);
  assert.ok(value.index.native_locator_count < value.index.modeled_subject_count);
  assert.equal(value.inventory.catalog_complete, false);
  assert.ok(value.inventory.provided_entry_count < value.inventory.entry_count);
  assert.equal(value.capsule.subjects.some((subject) => subject.path === "references/canon.md"), false);
  assert.ok(JSON.stringify(value).length < 40_000);
});

test("describe never imports or executes an inspected package", async (t) => {
  const root = await makeTestDir("describe-no-execute");
  t.after(() => removeTestDir(root));
  await writeFile(join(root, "SKILL.md"), "---\nname: unsafe-probe\ndescription: Probe package execution safety during maintenance inspection.\n---\n\n# Probe\n", "utf8");
  await writeFile(join(root, "spec.mjs"), [
    "import { writeFileSync } from 'node:fs';",
    "writeFileSync(new URL('./EXECUTED', import.meta.url), 'executed');",
    "export const SPEC = { version: 5, id: 'unsafe-probe' };",
    "export const STAGES = [];",
    ""
  ].join("\n"), "utf8");
  await writeFile(join(root, "collectors.mjs"), "throw new Error('collector executed');\n", "utf8");

  const value = await createMaintenanceContext(root, { query: "spec:STAGES/anything" });
  assert.equal(await exists(join(root, "EXECUTED")), false);
  assert.equal(value.snapshot.stable, true);
  assert.equal(value.assessment.full_validation, "not-assessed-no-package-source-execution");
  assert.equal(value.assessment.extraction.spec.status, "partial");
});

test("describe covers generated P0, authored P1 helpers, and unmanaged prose-code packages", async (t) => {
  const base = await makeTestDir("describe-profiles");
  t.after(() => removeTestDir(base));

  const p0Root = join(base, "p0");
  const p1Root = join(base, "p1");
  await generatePackage({ intent: await readJson(join(ROOT, "fixtures", "intents", "p0.json")), output: p0Root, requestedProfile: "p0" });
  await generatePackage({ intent: await readJson(join(ROOT, "fixtures", "intents", "p1.json")), output: p1Root, requestedProfile: "p1" });
  const helperPath = join(p1Root, "scripts", "run.mjs");
  await writeFile(helperPath, `${await readFile(helperPath, "utf8")}\n// causal-helper-sentinel-48d2\n`, "utf8");

  const p0 = await createMaintenanceContext(p0Root, { query: "intent:problem" });
  assert.equal(p0.query.status, "found");
  assert.equal(p0.classification.profile, "p0");
  assert.equal(p0.capsule.subjects.some((subject) => subject.kind.startsWith("spec-")), false);
  const p0Skill = await createMaintenanceContext(p0Root, { query: "file:SKILL.md" });
  const projectedSkill = p0Skill.capsule.subjects.find((subject) => subject.id === "file:SKILL.md");
  assert.equal(projectedSkill.generated, true);
  assert.equal(projectedSkill.authority, "intent-derived-projection");
  assert.ok(p0Skill.next.constraints.some((line) => /Do not hand-edit/.test(line)));
  assert.equal(p0Skill.next.change.length, 0);
  await unlink(join(p0Root, "agents", "openai.yaml"));
  const missingProjection = await createMaintenanceContext(p0Root, { query: "file:SKILL.md" });
  assert.equal(missingProjection.summary.extraction_status, "partial");
  assert.ok(missingProjection.issues.some((item) => item.code === "simple-projection-conflict" && item.path === "agents/openai.yaml"));

  const p1 = await createMaintenanceContext(p1Root, { query: "causal-helper-sentinel-48d2" });
  assert.equal(p1.query.status, "found");
  assert.equal(p1.classification.profile, "p1");
  assert.ok(p1.capsule.subjects.some((subject) => subject.kind === "source-text-hit" && subject.path === "scripts/run.mjs"));
  assert.equal(p1.assessment.relation_coverage.status, "discovery-only");
  assert.equal(p1.next.change.length, 0);

  const unmanaged = join(base, "unmanaged");
  await mkdir(unmanaged, { recursive: true });
  await writeFile(join(unmanaged, "SKILL.md"), "---\nname: unmanaged\ndescription: An existing skill without Skill Rails state.\n---\n\nRead scripts/helper.mjs when the delta gate changes.\n", "utf8");
  await mkdir(join(unmanaged, "scripts"), { recursive: true });
  await writeFile(join(unmanaged, "scripts", "helper.mjs"), "export const deltaGate = 'unmanaged-causal-sentinel-a18c';\n", "utf8");
  const plain = await createMaintenanceContext(unmanaged, { query: "unmanaged-causal-sentinel-a18c" });
  assert.equal(plain.query.status, "found");
  assert.equal(plain.classification.management, "inspectable-without-current-management-declaration");
  assert.ok(plain.capsule.subjects.some((subject) => subject.path === "scripts/helper.mjs"));
});

test("role-shaped traversal returns declared consumers without turning files into graph hubs", async () => {
  const body = await createMaintenanceContext(PILOT, { query: "body:stage: evidence" });
  assert.ok(body.capsule.subjects.some((subject) => subject.locator === "spec:STAGES/evidence"));
  assert.ok(body.capsule.relations.some((relation) => relation.kind === "uses-body" && relation.from_id === "spec:STAGES/evidence" && relation.to_id === "body:stage: evidence"));

  const observation = await createMaintenanceContext(PILOT, { query: "spec:OBSERVATIONS/result.selectionHash" });
  assert.ok(observation.capsule.relations.some((relation) => relation.kind === "reads" && relation.to_id === "spec:OBSERVATIONS/result.selectionHash"));

  const reference = await createMaintenanceContext(PILOT, { query: "file:references/verify.md" });
  assert.ok(reference.capsule.subjects.some((subject) => subject.locator === "spec:STAGES/evidence"));
  assert.ok(reference.capsule.relations.some((relation) => relation.kind === "links" && relation.to_id === "file:references/canon.md"));
  assert.ok(JSON.stringify(reference).length < 75_000);
});

test("structured and source extraction stays partial and source-precise on counterexamples", async (t) => {
  const base = await makeTestDir("describe-counterexamples");
  t.after(() => removeTestDir(base));

  const aliasRoot = join(base, "alias");
  await mkdir(aliasRoot, { recursive: true });
  await writeFile(join(aliasRoot, "SKILL.md"), "---\nname: alias\ndescription: Inspect an aliased static group without claiming complete absence.\n---\n\n# Alias\n", "utf8");
  await writeFile(join(aliasRoot, "spec.mjs"), "const localRoles = { verifier: { body: 'role: verifier' } };\nexport const ROLES = localRoles;\n", "utf8");
  const alias = await createMaintenanceContext(aliasRoot, { query: "spec:ROLES/verifier" });
  assert.equal(alias.query.status, "unknown");
  assert.equal(alias.assessment.extraction.spec.groups.ROLES.status, "partial");

  await writeFile(join(aliasRoot, "spec.mjs"), "export const STAGES = [{ id: 'same' }, { id: 'same' }];\n", "utf8");
  const duplicate = await createMaintenanceContext(aliasRoot, { query: "spec:STAGES/same" });
  const duplicateStages = duplicate.capsule.subjects.filter((subject) => subject.locator === "spec:STAGES/same");
  assert.equal(duplicateStages.length, 2);
  assert.equal(new Set(duplicateStages.map((subject) => subject.id)).size, 2);
  assert.ok(duplicateStages.every((subject) => subject.identity === "native-ambiguous"));

  const malformedRoot = join(base, "malformed");
  await mkdir(join(malformedRoot, ".skill-rails"), { recursive: true });
  await writeFile(join(malformedRoot, "SKILL.md"), "---\nname: malformed\ndescription: Preserve nearby sources when one structured family is malformed.\n---\n\n# Malformed\n", "utf8");
  await writeFile(join(malformedRoot, ".skill-rails", "obligation-ledger.json"), "{\"schema\":\"skill-rails/obligation-ledger/2\",\"atoms\":{}}\n", "utf8");
  const malformed = await createMaintenanceContext(malformedRoot, { query: "atom:not-present" });
  assert.equal(malformed.query.status, "unknown");
  assert.equal(malformed.assessment.extraction["obligation-ledger"].status, "partial");
  assert.ok(malformed.capsule.subjects.some((subject) => subject.id === "file:SKILL.md") || malformed.inventory.entries.some((entry) => entry.path === "SKILL.md"));

  const incompleteP0 = join(base, "incomplete-p0");
  await mkdir(join(incompleteP0, ".skill-rails"), { recursive: true });
  await writeFile(join(incompleteP0, "SKILL.md"), "---\nname: incomplete-p0\ndescription: Keep invalid managed packages inspectable without rendering projections.\n---\n\n# Incomplete\n", "utf8");
  await writeFile(join(incompleteP0, ".skill-rails", "intent.json"), "{\"name\":\"incomplete-p0\",\"description\":\"An incomplete intent that deliberately lacks its required problem field.\"}\n", "utf8");
  await writeFile(join(incompleteP0, ".skill-rails", "profile-decision.json"), "{\"schema\":\"skill-rails/profile-decision/1\",\"profile\":\"p0\",\"explicit\":true,\"signals\":[]}\n", "utf8");
  const incomplete = await createMaintenanceContext(incompleteP0, { query: "file:SKILL.md" });
  assert.equal(incomplete.query.status, "found");
  assert.equal(incomplete.assessment.extraction.intent.status, "partial");
  assert.equal(incomplete.assessment.extraction["simple-projections"].status, "partial");

  const sourceRoot = join(base, "source");
  await mkdir(join(sourceRoot, ".skill-rails"), { recursive: true });
  await writeFile(join(sourceRoot, "SKILL.md"), "---\nname: source\ndescription: Keep repeated JSON values mapped to their exact current source positions.\n---\n\n# Source\n", "utf8");
  await writeFile(join(sourceRoot, ".skill-rails", "intent.json"), "{\n  \"description\": \"same-source-value-91f3\",\n  \"problem\": \"same-source-value-91f3\"\n}\n", "utf8");
  await writeFile(join(sourceRoot, "helper.mjs"), "// import './ghost.mjs';\nexport { value } from './real.mjs';\nimport './implicit';\n", "utf8");
  await writeFile(join(sourceRoot, "real.mjs"), "export const value = 1;\n", "utf8");
  await writeFile(join(sourceRoot, "implicit.mjs"), "export const implicit = true;\n", "utf8");
  const source = await createMaintenanceContext(sourceRoot, { query: "same-source-value-91f3" });
  const repeated = source.capsule.subjects.filter((subject) => subject.kind === "intent-requirement");
  assert.equal(repeated.length, 2);
  assert.notDeepEqual(repeated[0].span, repeated[1].span);
  assert.ok(repeated.every((subject) => subject.span.start > 0 && subject.text === "\"same-source-value-91f3\""));
  assert.deepEqual(source.index.relation_families.find((family) => family.kind === "imports"), { kind: "imports", total: 2, resolved: 1, ambiguous: 0, unresolved: 1 });
});

test("exact-owner relation coverage fails closed on a silently unextractable declared reference", async (t) => {
  const root = await makeTestDir("describe-relation-coverage");
  t.after(() => removeTestDir(root));
  await cp(PILOT, root, { recursive: true });
  const specPath = join(root, "spec.mjs");
  const literal = await readFile(specPath, "utf8");
  const aliased = literal
    .replace("export const STAGES = [", "const evidenceBodyRef = \"stage: evidence\";\nexport const STAGES = [")
    .replace('  }, body: "stage: evidence" }\n];', "  }, body: evidenceBodyRef }\n];");
  assert.notEqual(aliased, literal);
  await writeFile(specPath, aliased, "utf8");

  const value = await createMaintenanceContext(root, { query: "spec:STAGES/evidence" });
  assert.equal(value.query.status, "found");
  assert.equal(value.assessment.relation_coverage.status, "blocked");
  assert.ok(value.assessment.relation_coverage.blockers.some((item) => item.code === "unresolved-relation-site" && item.family === "uses-body"));
  assert.equal(value.next.change.length, 0);
  assert.ok(value.next.read.some((item) => /cannot enumerate its uses-body edges/.test(item)));
  assert.doesNotMatch(renderMaintenanceContextText(value), /^- change:/m);
});

test("query caps report the omitted source matches instead of presenting a complete result", async (t) => {
  const root = await makeTestDir("describe-query-cap");
  t.after(() => removeTestDir(root));
  await writeFile(join(root, "SKILL.md"), `---\nname: capped\ndescription: Report every bounded query cut instead of implying exhaustive discovery.\n---\n\n${Array.from({ length: 30 }, () => "query-cap-sentinel-b27e").join("\n")}\n`, "utf8");
  const value = await createMaintenanceContext(root, { query: "query-cap-sentinel-b27e" });
  assert.deepEqual(value.query.source_text_scan, { total: 30, provided: 24, omitted: 6 });
  assert.ok(value.capsule.omitted.subjects >= 6);
  assert.ok(value.summary.critical_gaps.some((gap) => /Capsule truncated/.test(gap)));
});

test("describe CLI modes are exclusive, map is human-facing, and diagnose remains compatible", () => {
  const maintain = join(SKILL_ROOT, "scripts", "maintain.mjs");
  const described = spawnSync(process.execPath, [maintain, "--skill", PILOT, "--describe", "--query", "spec:STAGES/evidence", "--json"], { cwd: ROOT, encoding: "utf8", windowsHide: true });
  assert.equal(described.status, 0, described.stderr);
  assert.equal(JSON.parse(described.stdout).query.status, "found");
  assert.equal(described.stdout.trim().split("\n").length, 1, "the machine JSON lane must not spend context on pretty-print whitespace");
  assert.ok(described.stdout.length < 100_000);

  const conflict = spawnSync(process.execPath, [maintain, "--skill", PILOT, "--describe", "--diagnose"], { cwd: ROOT, encoding: "utf8", windowsHide: true });
  assert.notEqual(conflict.status, 0);
  assert.match(conflict.stderr, /exactly one maintenance mode/);

  const legacy = spawnSync(process.execPath, [maintain, "--skill", PILOT, "--diagnose", "--query", "stage:evidence"], { cwd: ROOT, encoding: "utf8", windowsHide: true });
  assert.equal(legacy.status, 0, legacy.stderr);
  assert.equal(JSON.parse(legacy.stdout).ok, true);
});

test("map preview exposes purpose, owners, limits, and an exact re-entry command", async () => {
  const value = await createMaintenanceContext(PILOT);
  const map = renderSkillMapPreview(value);
  assert.match(map, /^<!-- @generated by Skill Rails maintenance context preview/);
  assert.match(map, /## Purpose/);
  assert.match(map, /## Owners and consumers/);
  assert.match(map, /not a complete behavior proof or write\/runtime admission/);
  assert.match(map, /--describe --query <locator-or-interest> --json/);
});

test("the public spec locator resolver preserves L16's finite accepted universe", async () => {
  const source = await readFile(join(PILOT, "spec.mjs"), "utf8");
  const { analyzeSpecSource, staticValue } = await import("../skills/skill-rails/scripts/runtime/ast-policy.mjs");
  const analysis = analyzeSpecSource(source, "spec.mjs");
  const spec = Object.fromEntries(analysis.ast.body.flatMap((node) => node.type === "ExportNamedDeclaration" && node.declaration?.type === "VariableDeclaration"
    ? node.declaration.declarations.map((declaration) => [declaration.id.name, staticValue(declaration.init)])
    : []));
  assert.equal(resolveSpecLocator(spec, "STAGES/evidence").resolved, true);
  assert.equal(resolveSpecLocator(spec, "STAGES/length").resolved, false);
  assert.equal(resolveSpecLocator(spec, "STAGES/0").resolved, false);
  assert.equal(resolveSpecLocator({ ...spec, STAGES: [{ id: "0" }] }, "STAGES/0").resolved, true);
  assert.equal(resolveSpecLocator(spec, "TABLES/evidence/matching-pass").resolved, true);
  assert.equal(resolveSpecLocator(spec, "TABLES/evidence").shape, false);
  assert.equal(resolveSpecLocator(spec, "ORDERS/evidence").recognized, false);

  const root = await makeTestDir("locator-l16");
  try {
    const intent = {};
    await mkdir(join(root, ".skill-rails"), { recursive: true });
    await writeFile(join(root, ".skill-rails", "intent.json"), `${JSON.stringify(intent)}\n`, "utf8");
    await writeFile(join(root, ".skill-rails", "obligation-ledger.json"), `${JSON.stringify({
      schema: "skill-rails/obligation-ledger/2",
      intent_hash: sha256(intent),
      atoms: [{ id: "bad-locator", source: "intent:problem", text: "bad", disposition: "projected", targets: ["spec:STAGES/length"], evidence: ["spec:STAGES/length"] }]
    })}\n`, "utf8");
    const diagnostics = await validateAuthoringLedger(root, { ...spec, DEFERRED: [] }, { sections: [] }, []);
    assert.ok(diagnostics.some((item) => /Obligation locator does not resolve: spec:STAGES\/length/.test(item.message)));
  } finally {
    await removeTestDir(root);
  }
});
