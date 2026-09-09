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
  assert.ok(JSON.stringify(value).length < 77_000, "the exact-stage result must remain usable as AI context");
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

test("exact-owner capsules reserve direct required relations before explanatory fan-out", async (t) => {
  const root = await makeTestDir("describe-required-envelope");
  t.after(() => removeTestDir(root));
  await cp(PILOT, root, { recursive: true });
  const specPath = join(root, "spec.mjs");
  const source = await readFile(specPath, "utf8");
  const extraArtifacts = Array.from({ length: 80 }, (_, index) =>
    `  envelope${index}: { path: "state/envelope-${index}.json", writer: "project.consumer", readers: ["stage.evidence"], update: "replace", template: null },`
  ).join("\n");
  const expanded = source.replace("export const ARTIFACTS = {", `export const ARTIFACTS = {\n${extraArtifacts}`);
  assert.notEqual(expanded, source);
  await writeFile(specPath, expanded, "utf8");

  const value = await createMaintenanceContext(root, { query: "spec:STAGES/evidence" });
  const incomingReaders = value.capsule.relations.filter((relation) => relation.kind === "reader" && relation.to_id === "spec:STAGES/evidence");
  assert.equal(value.assessment.relation_coverage.status, "closed");
  assert.equal(incomingReaders.length, 84);
  assert.ok(value.capsule.relations.length <= value.limits.max_capsule_relations);
});

test("canonical structured sources use a separate finite parse budget", async (t) => {
  const root = await makeTestDir("describe-structured-budget");
  t.after(() => removeTestDir(root));
  await cp(PILOT, root, { recursive: true });
  const ledgerPath = join(root, ".skill-rails", "obligation-ledger.json");
  const ledger = await readJson(ledgerPath);
  ledger.atoms.push({ id: "unrelated-frontier", source: "intent.missing", targets: ["spec:STAGES/missing"], evidence: [] });
  ledger.structured_budget_probe = "x".repeat(600_000);
  await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");

  const supported = await createMaintenanceContext(root, { query: "spec:STAGES/evidence" });
  assert.equal(supported.assessment.extraction["obligation-ledger"].status, "complete-for-declared-scope");
  assert.equal(supported.assessment.relation_coverage.status, "closed");
  assert.equal(supported.limits.max_text_bytes, 512 * 1024);
  assert.equal(supported.limits.max_structured_text_bytes, 4 * 1024 * 1024);
  assert.ok(supported.frontiers.some((item) => /STAGES\/missing|intent:missing/.test(item.message)));

  const boundedOut = await createMaintenanceContext(root, { query: "spec:STAGES/evidence", maxStructuredTextBytes: 512 * 1024 });
  assert.equal(boundedOut.assessment.extraction["obligation-ledger"].status, "partial");
  assert.equal(boundedOut.assessment.relation_coverage.status, "blocked");
  assert.ok(boundedOut.assessment.relation_coverage.blockers.some((item) => item.code === "source-universe-incomplete" && item.family === "targets"));
});

test("duplicate locators within one obligation list remain one provenance edge", async (t) => {
  const root = await makeTestDir("describe-duplicate-provenance");
  t.after(() => removeTestDir(root));
  await cp(PILOT, root, { recursive: true });
  const ledgerPath = join(root, ".skill-rails", "obligation-ledger.json");
  const ledger = await readJson(ledgerPath);
  const atom = ledger.atoms.find((item) => item.targets?.includes("spec:STAGES/evidence"));
  assert.ok(atom);
  atom.targets = Array.from({ length: 201 }, () => "spec:STAGES/evidence");
  await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");

  const value = await createMaintenanceContext(root, { query: "spec:STAGES/evidence" });
  const edges = value.capsule.relations.filter((relation) => relation.kind === "targets" && relation.from_id === `atom:${atom.id}` && relation.to_id === "spec:STAGES/evidence");
  assert.equal(edges.length, 1);
  assert.equal(value.assessment.relation_coverage.status, "closed");
});

test("non-intent obligation origins remain explicit external provenance boundaries", async (t) => {
  const root = await makeTestDir("describe-external-provenance");
  t.after(() => removeTestDir(root));
  await cp(PILOT, root, { recursive: true });
  const ledgerPath = join(root, ".skill-rails", "obligation-ledger.json");
  const ledger = await readJson(ledgerPath);
  ledger.atoms.push({
    id: "migration-origin",
    source: "migration:SKILL.md:1-4",
    text: "Preserve the migrated requirement without pretending it came from current intent.",
    candidate_class: "judgment",
    consequence: "high",
    disposition: "review-required",
    targets: [],
    evidence: [],
    source_hash: `sha256:${"1".repeat(64)}`,
    source_kind: "frontmatter"
  });
  await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");

  const value = await createMaintenanceContext(root, { query: "atom:migration-origin" });
  const origin = value.capsule.relations.find((relation) => relation.kind === "originates-from" && relation.from_id === "atom:migration-origin");
  const external = value.capsule.subjects.find((subject) => subject.id === origin?.to_id);
  assert.equal(value.assessment.relation_coverage.status, "closed");
  assert.equal(origin?.resolution, "resolved");
  assert.equal(origin?.basis, "declared-external-provenance");
  assert.equal(external?.kind, "external-provenance");
  assert.equal(external?.identity, "external-boundary");
  assert.equal(external?.authority, "external-endpoint");
  assert.match(origin?.note ?? "", /not as current intent or execution evidence/);
});

test("external provenance identity preserves distinct declared source metadata", async (t) => {
  const root = await makeTestDir("describe-external-provenance-identity");
  t.after(() => removeTestDir(root));
  await cp(PILOT, root, { recursive: true });
  const ledgerPath = join(root, ".skill-rails", "obligation-ledger.json");
  const ledger = await readJson(ledgerPath);
  for (const [id, digit] of [["migration-first", "1"], ["migration-second", "2"]]) ledger.atoms.push({
    id,
    source: "migration:SKILL.md:1-4",
    text: id,
    candidate_class: "judgment",
    consequence: "high",
    disposition: "review-required",
    targets: [],
    evidence: [],
    source_hash: `sha256:${digit.repeat(64)}`,
    source_kind: "frontmatter"
  });
  const longSource = `migration:${"x".repeat(200_000)}`;
  ledger.atoms.push({
    id: "migration-long-source",
    source: longSource,
    text: "Keep the full source in structured data without flooding labels.",
    candidate_class: "judgment",
    consequence: "high",
    disposition: "review-required",
    targets: [],
    evidence: [],
    source_hash: `sha256:${"3".repeat(64)}`,
    source_kind: "paragraph"
  });
  await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");

  const value = await createMaintenanceContext(root, { query: "atom:migration-second" });
  const origin = value.capsule.relations.find((relation) => relation.kind === "originates-from" && relation.from_id === "atom:migration-second");
  const external = value.capsule.subjects.find((subject) => subject.id === origin?.to_id);
  assert.equal(value.assessment.relation_coverage.status, "closed");
  assert.equal(external?.data?.source_hash, `sha256:${"2".repeat(64)}`);

  const longValue = await createMaintenanceContext(root, { query: "atom:migration-long-source" });
  const longOrigin = longValue.capsule.relations.find((relation) => relation.kind === "originates-from" && relation.from_id === "atom:migration-long-source");
  const longExternal = longValue.capsule.subjects.find((subject) => subject.id === longOrigin?.to_id);
  assert.match(longExternal?.data?.source ?? "", /^migration:x+…$/);
  assert.ok((longExternal?.data?.source?.length ?? Infinity) <= 1801);
  assert.equal(longExternal?.data?.source_hash, `sha256:${"3".repeat(64)}`);
  assert.ok((longExternal?.display?.length ?? Infinity) <= 601);
  assert.ok(renderMaintenanceContextText(longValue).length < 40_000);
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
  assert.match(map, /Function and trigger \(intent\.description\):/);
  assert.match(map, /Problem \/ authoring objective \(intent\.problem\):/);
  assert.match(map, /## Owners and consumers/);
  assert.match(map, /not a complete behavior proof or write\/runtime admission/);
  assert.match(map, /--describe --query <locator-or-interest> --json/);
});

test("map exposes bounded package-local seams without inventing a workspace graph", async (t) => {
  const root = await makeTestDir("describe-declared-seams");
  t.after(() => removeTestDir(root));
  await writeFile(join(root, "SKILL.md"), "---\nname: seam-probe\ndescription: Show declared package seams without resolving another package.\n---\n\n# Seam Probe\n", "utf8");
  const longCondition = `Only after the named review condition is active, ${"keep the surrounding condition visible; ".repeat(20)}`;
  const longSibling = `<skill-root>/../${"s".repeat(650)}/references/long.md`;
  await writeFile(join(root, "body.md"), [
    "## why: purpose",
    "",
    "Always read `<skill-root>/../principles/references/policy-index.md` as shared policy without invoking its request classifier.",
    "",
    longCondition,
    "read `<skill-root>/../arch/references/workflow.md` for the selected columns only.",
    "",
    `Inspect \`${longSibling}\` only as a deliberately long literal lead.`,
    ""
  ].join("\n"), "utf8");
  const artifacts = Object.fromEntries(Array.from({ length: 9 }, (_, index) => [index === 0 ? "journal" : index === 1 ? "requestRecord" : `item${index}`, {
    path: index < 2 ? ".project/journal.md" : index === 2 ? `.project/<scope>/${"p".repeat(700)}.md` : `.project/item-${index}.md`,
    writer: index === 0 ? "external.principles" : index === 1 ? "direct" : index === 2 ? `external.${"w".repeat(300)}` : `external.owner-${index}`,
    readers: index === 0 ? Array.from({ length: 41 }, (__, reader) => reader === 0 ? `stage.${"r".repeat(300)}` : `stage.reader-${reader}`) : index === 1 ? [1, "stage.consumer-1"] : [`stage.consumer-${index}`]
  }]));
  await writeFile(join(root, "spec.mjs"), [
    "export const SPEC = { version: 5, id: 'seam-probe' };",
    `export const ARTIFACTS = ${JSON.stringify(artifacts, null, 2)};`,
    "export const READ_FIRST = [{ body: 'why: purpose' }];",
    ""
  ].join("\n"), "utf8");

  const value = await createMaintenanceContext(root);
  const seams = value.index.declared_seams;
  assert.equal(seams.outside_package_literals.total, 3);
  assert.equal(seams.outside_package_literals.provided, 3);
  assert.ok(seams.outside_package_literals.items.every((item) => item.owner_locator === "body:why: purpose"));
  assert.ok(seams.outside_package_literals.items.every((item) => item.read_first_declared_by.some((entry) => /^spec\.mjs:/.test(entry.source))));
  const conditionalLead = seams.outside_package_literals.items.find((item) => /\.\.\/arch\//.test(item.literal));
  assert.match(conditionalLead.context, /Only after the named review condition is active/);
  assert.match(conditionalLead.context, /<skill-root>\/\.\.\/arch\/references\/workflow\.md/);
  assert.match(conditionalLead.context, /context omitted/);
  assert.equal(conditionalLead.target_status, "not-inspected");
  const boundedLead = seams.outside_package_literals.items.find((item) => item.literal_truncated);
  assert.ok(boundedLead);
  assert.ok(boundedLead.literal.length <= 600);
  assert.equal(JSON.stringify(value).includes(longSibling), false);
  assert.ok(value.summary.critical_gaps.some((gap) => /truncated; open the exact source span/.test(gap)));

  assert.equal(seams.artifacts.status, "complete-for-declared-scope");
  assert.equal(seams.artifacts.total, 9);
  assert.equal(seams.artifacts.provided, 8);
  assert.equal(seams.artifacts.omitted, 1);
  const journal = seams.artifacts.items.find((item) => item.locator === "spec:ARTIFACTS/journal");
  const request = seams.artifacts.items.find((item) => item.locator === "spec:ARTIFACTS/requestRecord");
  assert.equal(journal.path, request.path);
  assert.notEqual(journal.writer, request.writer);
  assert.equal(journal.readers.provided.length, 6);
  assert.equal(journal.readers.total, 41);
  assert.equal(journal.readers.omitted, 35);
  const longArtifact = seams.artifacts.items.find((item) => item.locator === "spec:ARTIFACTS/item2");
  assert.equal(longArtifact.path_truncated, true);
  assert.equal(longArtifact.writer_truncated, true);

  const map = renderSkillMapPreview(value);
  assert.match(map, /## Package-local declared seams/);
  assert.match(map, /not a complete dependency map, verified handoff, or incoming-impact analysis/);
  assert.match(map, /Always read .*shared policy without invoking its request classifier/);
  assert.match(map, /spec:ARTIFACTS\/journal/);
  assert.match(map, /external\.principles/);
  assert.match(map, /\.project\/&lt;scope&gt;\//);
  assert.match(map, /truncated; query the artifact locator/);
  assert.match(map, /truncated; open the exact source span/);
  assert.match(map, /stage\.r+… \[truncated; query the artifact locator\]/);
  assert.match(map, /unknown, stage\.consumer-1/);
  assert.doesNotMatch(map, /\[object Object\]/);
  assert.doesNotMatch(map, /ROUTE:/);
  assert.ok(map.length < 40_000);
  assert.ok(JSON.stringify(value).length < 100_000);

  const exact = await createMaintenanceContext(root, { query: "spec:ARTIFACTS/journal" });
  assert.equal(Object.hasOwn(exact.index, "declared_seams"), false, "exact-owner output must not pay the overview seam cost");
  assert.ok(exact.capsule.relations.some((relation) => relation.kind === "writer"));

  await writeFile(join(root, "spec.mjs"), `export const SPEC = { version: 5, id: "seam-probe" };\nexport const ARTIFACTS = ${JSON.stringify(artifacts, null, 2)};\nexport const READ_FIRST = [];\n`, "utf8");
  const detached = await createMaintenanceContext(root);
  assert.ok(detached.index.declared_seams.outside_package_literals.items.every((item) => item.read_first_declared_by.length === 0));
  assert.equal(detached.index.declared_seams.outside_package_literals.total, 3, "literal observation remains even when READ_FIRST no longer selects its owner");
});

test("maintenance projection preserves null stage, intent field state, and outside-package literals without invented local edges", async (t) => {
  const base = await makeTestDir("describe-source-truth");
  t.after(() => removeTestDir(base));

  const p2Root = join(base, "p2");
  await generatePackage({ intent: await readJson(join(ROOT, "fixtures", "intents", "p2.json")), output: p2Root, requestedProfile: "p2" });
  const generated = await createMaintenanceContext(p2Root, { query: "fixture:complete" });
  assert.equal(generated.assessment.extraction["scenario-fixtures"].status, "complete-for-declared-scope");
  assert.equal(generated.issues.some((item) => /expect\.stage/.test(item.message)), false);
  const completeFixture = generated.capsule.subjects.find((subject) => subject.locator === "fixture:complete");
  assert.ok(completeFixture);
  assert.equal(generated.capsule.relations.some((relation) => relation.from_id === completeFixture.id && relation.kind === "declares-stage-expectation"), false);

  const fixturePath = join(p2Root, "fixtures", "scenarios.json");
  const invalidFixtures = await readJson(fixturePath);
  invalidFixtures.at(-1).expect.stage = 0;
  await writeFile(fixturePath, `${JSON.stringify(invalidFixtures, null, 2)}\n`, "utf8");
  const invalid = await createMaintenanceContext(p2Root);
  assert.equal(invalid.assessment.extraction["scenario-fixtures"].status, "partial");
  assert.ok(invalid.issues.some((item) => /expect\.stage must be a string or null/.test(item.message)));

  const proseRoot = join(base, "prose");
  await mkdir(join(proseRoot, ".skill-rails"), { recursive: true });
  await mkdir(join(proseRoot, "references"), { recursive: true });
  await mkdir(join(proseRoot, "scripts"), { recursive: true });
  await writeFile(join(proseRoot, ".skill-rails", "intent.json"), `${JSON.stringify({
    name: "source-truth",
    description: "Use when a maintainer needs the declared function and trigger without confusing it with the authoring problem.",
    problem: "Preserve distinct purpose fields and honest path boundaries in the maintenance preview.",
    use_cases: [], near_misses: [], inputs: [], outputs: [], irreversible_boundaries: [],
    state_dependent_behaviors: [], exact_formats: [], external_dependencies: [], completion_evidence: [], judgment_points: [], deterministic_helpers: []
  }, null, 2)}\n`, "utf8");
  await writeFile(join(proseRoot, "SKILL.md"), "---\nname: source-truth\ndescription: A fallback description that must not replace the captured intent description.\n---\n\n# Source Truth\n\nRead references/local.md, `<skill-root>/scripts/run.mjs`, and `<skill-root>/../principles/references/policy-index.md`. Do not infer https://example.test/references/remote.md, <skill-root>/../../bad/references/escape.md, x<skill-root>/scripts/false.mjs, or x<skill-root>/../false/references/prefix.md as package files.\n", "utf8");
  await writeFile(join(proseRoot, "references", "local.md"), "# Local\n", "utf8");
  await writeFile(join(proseRoot, "scripts", "run.mjs"), "export const run = true;\n", "utf8");

  const prose = await createMaintenanceContext(proseRoot, { query: "file:SKILL.md" });
  const map = renderSkillMapPreview(prose);
  assert.match(map, /Function and trigger \(intent\.description\): Use when a maintainer/);
  assert.match(map, /Problem \/ authoring objective \(intent\.problem\): Preserve distinct purpose fields/);
  assert.match(map, /Declared inputs: none declared in intent; this does not prove runtime or domain absence/);
  assert.match(map, /Declared outputs: none declared in intent; this does not prove runtime or domain absence/);
  assert.match(map, /Declared important boundaries: none declared in intent; this does not prove runtime or domain absence/);
  const local = await createMaintenanceContext(proseRoot, { query: "file:references/local.md" });
  assert.ok(local.capsule.relations.some((relation) => relation.kind === "literal-path-candidate" && relation.to_id === "file:references/local.md"));
  const anchored = await createMaintenanceContext(proseRoot, { query: "file:scripts/run.mjs" });
  assert.ok(anchored.capsule.relations.some((relation) => relation.kind === "literal-path-candidate" && relation.to_id === "file:scripts/run.mjs"));
  assert.equal(prose.capsule.relations.some((relation) => ["file:references/policy-index.md", "file:references/remote.md", "file:references/escape.md", "file:scripts/false.mjs"].includes(relation.to_id)), false);
  const outside = prose.frontiers.filter((item) => item.kind === "outside-selected-package-literal");
  assert.equal(outside.length, 1);
  assert.match(outside[0].source, /^SKILL\.md:/);
  assert.match(outside[0].message, /<skill-root>\/\.\.\/principles\/references\/policy-index\.md/);
  assert.match(outside[0].message, /existence, execution, freshness, and authority were not inspected/);
  assert.ok(prose.summary.critical_gaps.some((item) => /outside-selected-package-literal/.test(item)));
  assert.equal(prose.assessment.relation_coverage.status, "discovery-only");

  const sameIntent = await readJson(join(proseRoot, ".skill-rails", "intent.json"));
  delete sameIntent.outputs;
  sameIntent.irreversible_boundaries = "invalid-on-purpose";
  sameIntent.problem = sameIntent.description;
  await writeFile(join(proseRoot, ".skill-rails", "intent.json"), `${JSON.stringify(sameIntent, null, 2)}\n`, "utf8");
  const sameMap = renderSkillMapPreview(await createMaintenanceContext(proseRoot));
  assert.equal(sameMap.match(/Function and trigger \(intent\.description\):/g)?.length, 1);
  assert.equal(sameMap.match(/Problem \/ authoring objective \(intent\.problem\):/g)?.length, 1);
  assert.match(sameMap, /Declared inputs: none declared in intent; this does not prove runtime or domain absence/);
  assert.match(sameMap, /Declared outputs: unknown in current bounded sources/);
  assert.match(sameMap, /Declared important boundaries: unknown in current bounded sources/);
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
