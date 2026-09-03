import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { generatePackage } from "../skills/skill-rails/scripts/lib/generator.mjs";
import { buildP2 } from "../skills/skill-rails/scripts/lib/build-core.mjs";
import { inspectProseSkill, inferMigrationIntent, writeMigrationLedger } from "../skills/skill-rails/scripts/lib/migration.mjs";
import { maintainPackage } from "../skills/skill-rails/scripts/lib/maintenance.mjs";
import { semanticDiff, snapshotContract } from "../skills/skill-rails/scripts/lib/semantic-diff.mjs";
import { lintSimpleSkill } from "../skills/skill-rails/scripts/lib/simple-lint.mjs";
import { assertExternalStateDir } from "../skills/skill-rails/scripts/runtime/trace-core.mjs";
import { createDirectoryAtomic, exists, listFiles, readJson } from "../skills/skill-rails/scripts/lib/io.mjs";
import { hashFile, sha256 } from "../skills/skill-rails/scripts/runtime/hash.mjs";
import { parseArgs } from "../skills/skill-rails/scripts/lib/args.mjs";
import { validateFull } from "../skills/skill-rails/scripts/runtime/validator.mjs";
import { ROOT, SKILL_ROOT, makeTestDir, removeTestDir } from "./helpers.mjs";

test("authoring CLIs fail closed on unknown options before running work", () => {
  const result = spawnSync(process.execPath, [join(SKILL_ROOT, "scripts", "eval.mjs"), "--help", "true"], {
    cwd: ROOT, encoding: "utf8", windowsHide: true
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown option: --help/);
  assert.equal(result.stdout, "");
  assert.throws(() => parseArgs(["--dry-run", "false"], { booleans: ["dry-run"] }), /separate value is forbidden/);
});

test("creator self-evaluation works without generated authoring state", () => {
  const result = spawnSync(process.execPath, [join(SKILL_ROOT, "scripts", "eval.mjs"), "--skill", SKILL_ROOT], {
    cwd: ROOT, encoding: "utf8", windowsHide: true
  });
  assert.equal(result.status, 1);
  assert.equal(result.stderr, "");
  const report = JSON.parse(result.stdout);
  assert.equal(report.structural.ok, true);
  assert.equal(report.kind, "creator");
  assert.equal(report.profile, "p1");
  assert.equal(report.release_readiness, "creator-forward-test-required");
});

test("starter intent template does not inject undeclared array requirements", async () => {
  const intent = await readJson(join(SKILL_ROOT, "templates", "intent-brief.json"));
  for (const [field, value] of Object.entries(intent)) if (Array.isArray(value)) assert.deepEqual(value, [], `${field} must start empty`);
});

test("human-only documentation stays outside installed skill routing", async () => {
  const entryPoints = await Promise.all([
    readFile(join(SKILL_ROOT, "SKILL.md"), "utf8"),
    readFile(join(SKILL_ROOT, "references", "authoring-workflow.md"), "utf8"),
    readFile(join(ROOT, "AGENTS.md"), "utf8"),
    readFile(join(ROOT, "CLAUDE.md"), "utf8"),
    readFile(join(ROOT, "README.md"), "utf8"),
    readFile(join(ROOT, "README.ko.md"), "utf8")
  ]);
  for (const entry of entryPoints) assert.doesNotMatch(entry, /readme-authoring\.md|platform-adapters\.md/);
  assert.equal(await exists(join(ROOT, "docs", "readme-authoring.md")), true);
  assert.equal(await exists(join(SKILL_ROOT, "references", "readme-authoring.md")), false);
  assert.equal(await exists(join(SKILL_ROOT, "references", "platform-adapters.md")), false);
});

test("the published skill directory excludes repository-only fixtures and nested skills", async () => {
  assert.equal(await exists(join(ROOT, "SKILL.md")), false);
  for (const directory of ["docs", "evals", "fixtures", "tests"]) {
    assert.equal(await exists(join(SKILL_ROOT, directory)), false, `${directory} must stay outside the installed skill`);
  }
  const skillFiles = (await listFiles(SKILL_ROOT))
    .map((path) => relative(SKILL_ROOT, path).replaceAll("\\", "/"))
    .filter((path) => path === "SKILL.md" || path.endsWith("/SKILL.md"));
  assert.deepEqual(skillFiles, ["SKILL.md"]);
});

test("P2 authoring aid requires consumer consumption-set disclosure", async () => {
  const [card, workflow] = await Promise.all([
    readFile(join(SKILL_ROOT, "templates", "authoring-card.md"), "utf8"),
    readFile(join(SKILL_ROOT, "references", "authoring-workflow.md"), "utf8")
  ]);
  assert.match(card, /Consumer consumption sets:/);
  assert.match(card, /one canonical `ARTIFACTS` entry/);
  assert.match(card, /Non-file observations need no placeholder artifact/);
  assert.match(card, /not consumer disclosure surfaces/);
  assert.match(workflow, /named consumption set for each consumer/);
  assert.match(workflow, /current Decision's `stage_artifacts`/);
  assert.match(workflow, /neither counts as consumer disclosure/);
});

test("related-skill guidance keeps profiles local and P2 behavior at its canonical owners", async () => {
  const [entry, workflow, contract] = await Promise.all([
    readFile(join(SKILL_ROOT, "SKILL.md"), "utf8"),
    readFile(join(SKILL_ROOT, "references", "authoring-workflow.md"), "utf8"),
    readFile(join(SKILL_ROOT, "references", "p2-contract.md"), "utf8")
  ]);
  assert.match(entry, /one target skill at a time/);
  assert.match(entry, /never for an entire plugin or repository/);
  assert.match(entry, /each target package keeps behavior and judgment at its profile's canonical owners/);
  assert.match(entry, /never make one generated skill invoke another/);
  assert.match(workflow, /For P0\/P1, record that durable path and heading in `external_dependencies`/);
  assert.match(workflow, /For P2, a shared file or helper is consumed domain input or implementation, not a second behavior source/);
  assert.match(workflow, /observable conditions, guards, stages, tables, exact formats, ordered effects, ownership, and completion evidence stay in `spec\.mjs`/);
  assert.match(workflow, /judgment criteria and their framing stay in `body\.md`/);
  assert.match(workflow, /Naming a shared dependency grants it no behavior, judgment, freshness, or evidence authority/);
  assert.match(workflow, /proves neither that the file exists nor that its contents are valid or fresh/);
  assert.match(contract, /`spec\.mjs` exclusively owns observable conditions, guards, stage order, decision tables, effect order, exact formats, ownership, and completion evidence/);
  assert.match(contract, /`body\.md` owns judgment criteria and reasons/);
  assert.match(contract, /A declaration proves neither that the path currently exists nor that its contents are valid or fresh/);
  assert.match(workflow, /does not validate an entire suite, propagate a shared edit across packages/);
  assert.match(workflow, /report them as `unproven` rather than widening the core grammar/);
});

test("simple profiles expose a precise shared dependency on the cold-user path", async (t) => {
  const base = await makeTestDir("shared-dependency-guidance");
  t.after(() => removeTestDir(base));
  const intent = await readJson(join(ROOT, "fixtures", "intents", "p0.json"));
  intent.external_dependencies = ["When reviewing incident data, read docs/compliance.md#incident-identifiers because the repository owns the current identifier contract."];
  const output = join(base, "skill");
  await generatePackage({ intent, output, requestedProfile: "p0" });
  const generated = await readFile(join(output, "SKILL.md"), "utf8");
  assert.match(generated, /## External Dependencies\n\n- When reviewing incident data, read docs\/compliance\.md#incident-identifiers because the repository owns the current identifier contract\./);
  assert.match(generated, /Respect every boundary, state-dependent rule, exact format, and external dependency shown above/);
});

test("portable creator commands use only package-local runtime dependencies", async (t) => {
  const base = await makeTestDir("thin-dependency-boundary");
  t.after(() => removeTestDir(base));
  const loader = pathToFileURL(join(ROOT, "fixtures", "reject-external-runtime-dependencies-loader.mjs")).href;
  const run = (script, args) => spawnSync(process.execPath, ["--experimental-loader", loader, join(SKILL_ROOT, "scripts", script), ...args], { cwd: ROOT, encoding: "utf8", windowsHide: true });
  for (const profile of ["p0", "p1", "p2"]) {
    const result = run("init.mjs", ["--intent", join(ROOT, "fixtures", "intents", `${profile}.json`), "--out", join(base, profile)]);
    assert.equal(result.status, 0, result.stderr);
  }
  for (const [script, args, expected] of [["lint.mjs", ["--self"], 0], ["build.mjs", ["--self"], 0], ["eval.mjs", ["--skill", SKILL_ROOT], 1]]) {
    const result = run(script, args);
    assert.equal(result.status, expected, result.stderr);
    assert.doesNotMatch(result.stderr, /External runtime dependency loaded/);
  }
  const maintenance = run("maintain.mjs", ["--skill", join(base, "p2"), "--diagnose", "--query", "stage:operate"]);
  assert.equal(maintenance.status, 0, maintenance.stderr);
  assert.doesNotMatch(maintenance.stderr, /External runtime dependency loaded/);
  const migration = run("migrate.mjs", ["--source", join(ROOT, "fixtures", "migration-structures"), "--out", join(base, "migration"), "--no-build"]);
  assert.equal(migration.status, 0, migration.stderr);
  assert.doesNotMatch(migration.stderr, /External runtime dependency loaded/);
});

test("conservative migration records every atom and leaves the source unchanged", async (t) => {
  const base = await makeTestDir("migration");
  t.after(() => removeTestDir(base));
  const source = join(ROOT, "fixtures", "migration-source");
  const sourcePath = join(source, "SKILL.md");
  const before = sha256(await readFile(sourcePath, "utf8"));
  const inspection = await inspectProseSkill(source);
  const intent = await inferMigrationIntent(source, inspection);
  const output = join(base, "migrated");
  await generatePackage({ intent, output, requestedProfile: "p2", finalize: async (stage) => { await writeMigrationLedger(stage, inspection); await buildP2(stage, { repeats: 3 }); } });
  const after = sha256(await readFile(sourcePath, "utf8"));
  assert.equal(after, before);
  const ledgerPath = join(output, ".skill-rails", "obligation-ledger.json");
  const ledger = await readJson(ledgerPath);
  const migrationAtoms = ledger.atoms.filter((atom) => atom.source.startsWith("migration:"));
  assert.equal(migrationAtoms.length, inspection.atoms.length);
  assert.ok(migrationAtoms.every((atom) => atom.disposition === "review-required" && atom.source_hash && atom.targets.length === 0 && atom.evidence.length === 0));
  assert.equal(await exists(join(output, ".generated.json")), true);

  ledger.atoms = ledger.atoms.map((atom) => atom.source.startsWith("migration:") ? atom : { ...atom, disposition: "projected", targets: ["body:why: purpose"], evidence: ["body:why: purpose"] });
  await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
  const specPath = join(output, "spec.mjs");
  const spec = await readFile(specPath, "utf8");
  await writeFile(specPath, spec.replace(/export const DEFERRED = \[[^\n]*\];/, "export const DEFERRED = [];"), "utf8");
  const releaseAttempt = await validateFull(output);
  assert.equal(releaseAttempt.ok, false);
  assert.ok(releaseAttempt.diagnostics.some((item) => item.code === "L16" && item.pointer.includes("migration-a0001")));
});

test("migration preserves Markdown semantic units, metadata, and parser-consumed definitions", async (t) => {
  const base = await makeTestDir("migration-structures");
  t.after(() => removeTestDir(base));
  const source = join(ROOT, "fixtures", "migration-structures");
  const inspection = await inspectProseSkill(source);
  const atoms = inspection.atoms;
  const kinds = atoms.map((atom) => atom.source_kind);
  assert.deepEqual(kinds, [
    "frontmatter", "heading", "paragraph", "list-item", "list-item", "list-item",
    "heading", "table-row", "table-row", "table-row", "reference-definition", "fenced-code"
  ]);

  const [frontmatter, paragraph, outerItem, nestedItem, tableHeader, failedRow, reference, code] = [
    atoms.find((atom) => atom.source_kind === "frontmatter"),
    atoms.find((atom) => atom.original_text.startsWith("Run the verification")),
    atoms.find((atom) => atom.original_text.startsWith("- Block publication")),
    atoms.find((atom) => atom.original_text.startsWith("  - Check the child")),
    atoms.find((atom) => atom.original_text === "| State | Action |"),
    atoms.find((atom) => atom.original_text === "| verification fails | never publish |"),
    atoms.find((atom) => atom.source_kind === "reference-definition"),
    atoms.find((atom) => atom.source_kind === "fenced-code")
  ];
  assert.match(frontmatter.original_text, /allowed-tools: Read, Write/);
  assert.match(frontmatter.original_text, /license: MIT/);
  assert.match(frontmatter.original_text, /compatibility: Codex and Claude Code/);
  assert.match(frontmatter.original_text, /disable-model-invocation: true/);
  assert.match(frontmatter.original_text, /user-invocable: false/);
  assert.match(frontmatter.original_text, /x-future-metadata: preserve exactly/);
  assert.equal(frontmatter.source_span, "1-10");
  assert.deepEqual(frontmatter.context, []);
  assert.equal(paragraph.original_text, "Run the verification command and record its result.\nThe second sentence stays in this paragraph.");
  assert.equal(paragraph.candidate_class, "ambiguous/review-required");
  assert.equal(outerItem.original_text, "- Block publication when verification fails.\n  Keep this continuation with the item.\n  - Check the child evidence.\n    Keep nested detail with the child.");
  assert.equal(nestedItem.original_text, "  - Check the child evidence.\n    Keep nested detail with the child.");
  assert.equal(code.original_text, "```sh\nif verify; then\n  echo \"verified\"\nfi\n```");
  assert.equal(reference.original_text, "[release-policy]: https://example.test/release-policy");
  assert.equal(reference.candidate_class, "declaration");
  assert.deepEqual(reference.context.map((item) => item.text), ["Release gate", "Decision matrix"]);
  const sourceLines = (await readFile(join(source, "SKILL.md"), "utf8")).split(/\r?\n/);
  for (const atom of [frontmatter, reference]) {
    const [start, end] = atom.source_span.split("-").map(Number);
    assert.equal(sourceLines.slice(start - 1, end).join("\n"), atom.original_text);
  }
  assert.deepEqual(paragraph.context.map((item) => item.text), ["Release gate"]);
  assert.deepEqual(tableHeader.context.map((item) => item.text), ["Release gate", "Decision matrix"]);
  assert.equal(tableHeader.candidate_class, "table row");
  assert.equal(failedRow.candidate_class, "table row");
  for (const atom of atoms) assert.equal(atom.source_hash, sha256(atom.original_text));
  assert.equal(failedRow.source_span, "27-27");

  const intent = await inferMigrationIntent(source, inspection);
  const output = join(base, "migrated");
  await generatePackage({ intent, output, requestedProfile: "p2", finalize: async (stage) => {
    await writeMigrationLedger(stage, inspection);
    await buildP2(stage, { repeats: 1 });
  } });
  const ledger = await readJson(join(output, ".skill-rails", "obligation-ledger.json"));
  const migrationAtoms = ledger.atoms.filter((atom) => atom.source.startsWith("migration:"));
  assert.deepEqual(migrationAtoms.map((atom) => atom.text), atoms.map((atom) => atom.original_text));
  assert.deepEqual(migrationAtoms.map((atom) => atom.source_kind), kinds);
  assert.deepEqual(migrationAtoms.map((atom) => atom.context), atoms.map((atom) => atom.context));
  for (const sourceKind of ["frontmatter", "reference-definition"]) {
    const sourceAtom = atoms.find((atom) => atom.source_kind === sourceKind);
    const ledgerAtom = migrationAtoms.find((atom) => atom.source_kind === sourceKind);
    assert.equal(ledgerAtom.source_hash, sourceAtom.source_hash);
    assert.equal(ledgerAtom.source, `migration:${sourceAtom.source_path}:${sourceAtom.source_span}`);
  }
  assert.ok(migrationAtoms.some((atom) => atom.text === nestedItem.original_text));
  assert.ok(migrationAtoms.some((atom) => atom.text === failedRow.original_text));
  assert.ok(migrationAtoms.some((atom) => atom.text === code.original_text));
});

test("migration inventories non-Markdown files as conservative review atoms", async (t) => {
  const base = await makeTestDir("migration-nonmarkdown");
  t.after(() => removeTestDir(base));
  const source = join(ROOT, "fixtures", "migration-nonmarkdown");
  const inspection = await inspectProseSkill(source);
  const expectedFiles = [
    "SKILL.md", "agents/openai.yaml", "assets/sample.bin", "empty.txt", "references/source-notes.txt", "scripts/run.mjs"
  ];
  const relativeFiles = inspection.files.map((file) => file.slice(source.length + 1).replace(/\\/g, "/"));
  assert.deepEqual(relativeFiles, expectedFiles);
  const before = new Map(await Promise.all(inspection.files.map(async (file) => [file, sha256(await readFile(file))])));
  const fileAtoms = inspection.atoms.filter((atom) => atom.source_kind.startsWith("file-"));
  assert.equal(fileAtoms.length, expectedFiles.length - 1);
  assert.deepEqual(fileAtoms.map((atom) => atom.source_path), expectedFiles.slice(1));
  for (const atom of fileAtoms) {
    assert.equal(atom.source_span, "file");
    assert.equal(atom.candidate_class, "ambiguous/review-required");
    assert.equal(atom.disposition, "review-required");
    assert.equal(atom.target_id, null);
    assert.equal(atom.fixture_or_review_evidence, null);
  }

  const yaml = fileAtoms.find((atom) => atom.source_path === "agents/openai.yaml");
  const script = fileAtoms.find((atom) => atom.source_path === "scripts/run.mjs");
  const reference = fileAtoms.find((atom) => atom.source_path === "references/source-notes.txt");
  const empty = fileAtoms.find((atom) => atom.source_path === "empty.txt");
  const opaque = fileAtoms.find((atom) => atom.source_path === "assets/sample.bin");
  for (const [atom, path] of [[yaml, "agents/openai.yaml"], [script, "scripts/run.mjs"], [reference, "references/source-notes.txt"], [empty, "empty.txt"]]) {
    const bytes = await readFile(join(source, path));
    assert.equal(atom.source_kind, "file-text");
    assert.equal(atom.original_text, bytes.toString("utf8"));
    assert.equal(atom.source_hash, sha256(bytes));
    assert.equal(atom.byte_count, bytes.length);
  }
  const opaqueBytes = await readFile(join(source, "assets/sample.bin"));
  assert.equal(opaque.source_kind, "file-opaque");
  assert.equal(opaque.source_hash, sha256(opaqueBytes));
  assert.equal(opaque.byte_count, opaqueBytes.length);
  assert.match(opaque.original_text, /Opaque file/);
  assert.notEqual(opaque.original_text, Buffer.from(opaqueBytes).toString("base64"));

  const intent = await inferMigrationIntent(source, inspection);
  const output = join(base, "migrated");
  await generatePackage({ intent, output, finalize: async (stage) => {
    await writeMigrationLedger(stage, inspection);
    await buildP2(stage, { repeats: 1 });
  } });
  const ledger = await readJson(join(output, ".skill-rails", "obligation-ledger.json"));
  const migrationAtoms = ledger.atoms.filter((atom) => atom.source.startsWith("migration:"));
  assert.equal(migrationAtoms.length, inspection.atoms.length);
  assert.deepEqual(ledger.migration.source_files, relativeFiles);
  assert.ok(migrationAtoms.every((atom) => atom.disposition === "review-required" && atom.targets.length === 0 && atom.evidence.length === 0));
  for (const atom of fileAtoms) {
    const ledgerAtom = migrationAtoms.find((item) => item.source_kind === atom.source_kind && item.source.includes(`:${atom.source_path}:`));
    assert.equal(ledgerAtom.source_hash, atom.source_hash);
    assert.equal(ledgerAtom.byte_count, atom.byte_count);
    assert.equal(ledgerAtom.text, atom.original_text);
  }
  const after = new Map(await Promise.all(inspection.files.map(async (file) => [file, sha256(await readFile(file))])));
  assert.deepEqual(after, before);

  const invalidMarkdownRoot = join(base, "invalid-markdown");
  await mkdir(invalidMarkdownRoot, { recursive: true });
  await writeFile(join(invalidMarkdownRoot, "SKILL.md"), "---\nname: invalid-markdown\ndescription: Preserve invalid Markdown bytes.\n---\n\n# Valid source\n", "utf8");
  const invalidBytes = Uint8Array.from([0xff, 0x00, 0xfe]);
  await writeFile(join(invalidMarkdownRoot, "opaque.md"), invalidBytes);
  const invalidInspection = await inspectProseSkill(invalidMarkdownRoot);
  const invalidAtom = invalidInspection.atoms.find((atom) => atom.source_path === "opaque.md");
  assert.equal(invalidAtom.source_kind, "file-opaque");
  assert.equal(invalidAtom.source_hash, sha256(invalidBytes));
  assert.equal(invalidAtom.byte_count, invalidBytes.byteLength);
});

test("maintenance applies stable-id body changes atomically and reports semantic impact", async (t) => {
  const base = await makeTestDir("maintenance");
  t.after(() => removeTestDir(base));
  const root = join(base, "skill");
  const intent = await readJson(join(ROOT, "fixtures", "intents", "p2.json"));
  await generatePackage({ intent, output: root, finalize: async (stage) => buildP2(stage, { repeats: 3 }) });
  const report = await maintainPackage(root, {
    id: "clarify-operate-judgment",
    intent: "Clarify that behavior evidence is separate from structural validity.",
    operations: [{
      type: "replace-body-section", id: "stage: operate",
      content: "Judgment: authoring.readiness is one of ready, needs-design, or complete. Treat this package as behavior-complete only after user-specific obligations and forward evidence exist.\n\nWhy: A passing structural build proves shape, not real-world adherence."
    }]
  }, { repeats: 3 });
  assert.equal(report.changed, false);
  assert.equal(report.groups.body.length, 1);
  assert.equal(report.groups.body[0].id, "stage: operate");
  assert.match(await readFile(join(root, "body.md"), "utf8"), /forward evidence exist/);
  assert.equal(await exists(join(root, ".generated.json")), true);
});

test("P2 typed-artifact maintenance preflights closed canonical paths and preserves legacy replace-spec", async (t) => {
  const base = await makeTestDir("typed-artifact-maintenance");
  t.after(() => removeTestDir(base));
  const root = join(base, "skill");
  const intent = await readJson(join(ROOT, "fixtures", "intents", "p2.json"));
  // References are authored, not generated; seal one before the build so the reference kind has a target.
  await generatePackage({ intent, output: root, finalize: async (stage) => {
    await writeFile(join(stage, "references", "context.md"), "# Context\n\nAuthored reference under maintenance.\n", "utf8");
    return buildP2(stage, { repeats: 1 });
  } });

  const paths = {
    spec: join(root, "spec.mjs"),
    collector: join(root, "collectors", "index.mjs"),
    reference: join(root, "references", "context.md")
  };
  const before = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([kind, path]) => [kind, await readFile(path, "utf8")])));
  const after = {
    spec: `${before.spec}\n// replace-artifact spec receipt\n`,
    collector: `${before.collector}\n// replace-artifact collector receipt\n`,
    reference: `${before.reference}\nTyped-artifact context receipt.\n`
  };
  const publicChange = {
    id: "typed-artifact-happy-path",
    operations: [
      { type: "replace-artifact", kind: "spec", path: "spec.mjs", profile: "p2", expected_hash: sha256(before.spec), content: after.spec },
      { type: "replace-artifact", kind: "collector", path: "collectors/index.mjs", profile: "p2", expected_hash: sha256(before.collector), content: after.collector },
      { type: "replace-artifact", kind: "reference", path: "references/context.md", profile: "p2", expected_hash: sha256(before.reference), content: after.reference }
    ]
  };
  const publicChangePath = join(base, "typed-artifact-change.json");
  await writeFile(publicChangePath, JSON.stringify(publicChange), "utf8");
  const publicRun = spawnSync(process.execPath, [join(SKILL_ROOT, "scripts", "maintain.mjs"), "--skill", root, "--change", publicChangePath, "--repeats", "1", "--json"], { cwd: ROOT, encoding: "utf8", windowsHide: true });
  assert.equal(publicRun.status, 0, publicRun.stderr);
  const report = JSON.parse(publicRun.stdout).report;
  assert.deepEqual(report.artifact_receipts.map(({ kind, path }) => ({ kind, path })), [
    { kind: "spec", path: "spec.mjs" },
    { kind: "collector", path: "collectors/index.mjs" },
    { kind: "reference", path: "references/context.md" }
  ]);
  assert.equal(report.artifact_receipts.every((item) => item.before_hash !== item.after_hash), true);
  assert.deepEqual(report.source_changes, { behavior_source: true, observation_source: true, context: true });
  assert.equal(report.any_changed, true);
  for (const [kind, path] of Object.entries(paths)) assert.equal(await readFile(path, "utf8"), after[kind]);

  const current = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([kind, path]) => [kind, await readFile(path, "utf8")])));
  const generatedPath = join(root, "scripts", "skill-rails", "run.mjs");
  const rejected = [
    { pattern: /unsupported kind/, operation: { type: "replace-artifact", kind: "template", path: "templates/result.md", profile: "p2", expected_hash: await hashFile(join(root, "templates", "result.md")), content: "unchanged" } },
    { pattern: /not registered for kind spec/, operation: { type: "replace-artifact", kind: "spec", path: "collectors/index.mjs", profile: "p2", expected_hash: sha256(current.collector), content: current.collector } },
    { pattern: /requires profile p2/, operation: { type: "replace-artifact", kind: "spec", path: "spec.mjs", profile: "p1", expected_hash: sha256(current.spec), content: current.spec } },
    { pattern: /current expected_hash/, operation: { type: "replace-artifact", kind: "spec", path: "spec.mjs", profile: "p2", expected_hash: `sha256:${"0".repeat(64)}`, content: current.spec } },
    { pattern: /refuses generated path/, operation: { type: "replace-artifact", kind: "reference", path: "scripts/skill-rails/run.mjs", profile: "p2", expected_hash: await hashFile(generatedPath), content: await readFile(generatedPath, "utf8") } },
    { pattern: /requires an existing target/, operation: { type: "replace-artifact", kind: "reference", path: "references/missing.md", profile: "p2", expected_hash: `sha256:${"0".repeat(64)}`, content: "missing" } }
  ];
  for (const { pattern, operation } of rejected) {
    const fingerprint = await treeFingerprint(root);
    await assert.rejects(maintainPackage(root, { operations: [operation] }, { repeats: 1 }), pattern);
    assert.equal(await treeFingerprint(root), fingerprint);
  }

  await t.test("captured backups, canonical aliases, and unsupported reparse entries fail recoverably", async (t) => {
    await assert.rejects(maintainPackage(root, { operations: [{
      type: "replace-artifact", kind: "reference", path: "references/./context.md", profile: "p2",
      expected_hash: sha256(current.reference), content: current.reference
    }] }, { repeats: 1 }), /canonical portable spelling/);
    await assert.rejects(maintainPackage(root, { operations: [{
      type: "replace-artifact", kind: "reference", path: "references\\context.md", profile: "p2",
      expected_hash: sha256(current.reference), content: current.reference
    }] }, { repeats: 1 }), /portable package-relative path/);
    await assert.rejects(maintainPackage(root, { operations: [{
      type: "replace-artifact", kind: "reference", path: "references/../references/context.md", profile: "p2",
      expected_hash: sha256(current.reference), content: current.reference
    }] }, { repeats: 1 }), /canonical portable spelling/);
    if (process.platform === "win32") await assert.rejects(maintainPackage(root, { operations: [
      { type: "replace-artifact", kind: "reference", path: "references/context.md", profile: "p2", expected_hash: sha256(current.reference), content: current.reference },
      { type: "replace-artifact", kind: "reference", path: "references/CONTEXT.md", profile: "p2", expected_hash: sha256(current.reference), content: current.reference }
    ] }, { repeats: 1 }), /canonical physical spelling|physical file only once/);

    const atomicRoot = join(base, "captured-backup-obstruction");
    await mkdir(atomicRoot, { recursive: true });
    await writeFile(join(atomicRoot, "original.txt"), "original\n", "utf8");
    let capturedBackup;
    let installFailure;
    await assert.rejects(createDirectoryAtomic(atomicRoot, async (stage) => {
      await writeFile(join(stage, "candidate.txt"), "candidate\n", "utf8");
    }, {
      replace: true,
      replaceNonEmpty: true,
      verifyBackup: async ({ target, backup }) => {
        capturedBackup = backup;
        await writeFile(join(backup, "concurrent.txt"), "captured concurrent bytes\n", "utf8");
        await mkdir(target, { recursive: false });
        await writeFile(join(target, "foreign.txt"), "foreign owner\n", "utf8");
        throw new Error("captured backup fingerprint mismatch witness");
      }
    }), (error) => {
      installFailure = error;
      return /captured backup fingerprint mismatch witness/.test(error.message);
    });
    assert.equal(await readFile(join(atomicRoot, "foreign.txt"), "utf8"), "foreign owner\n");
    assert.equal(await readFile(join(capturedBackup, "original.txt"), "utf8"), "original\n");
    assert.equal(await readFile(join(capturedBackup, "concurrent.txt"), "utf8"), "captured concurrent bytes\n");
    assert.equal(installFailure.message.includes(`captured_backup=preserved at ${capturedBackup}`), true);
    assert.equal(installFailure.message.includes(`target=present at ${atomicRoot}`), true);

    const linkPath = join(root, "references", "purpose-link.md");
    let linkCreated = false;
    try {
      await symlink("purpose.md", linkPath, "file");
      linkCreated = true;
    } catch (error) {
      if (!["EACCES", "EPERM", "ENOSYS"].includes(error?.code)) throw error;
      if (process.platform === "win32") {
        const junctionTarget = join(base, "junction-target");
        await mkdir(junctionTarget, { recursive: true });
        try {
          await symlink(junctionTarget, linkPath, "junction");
          linkCreated = true;
        } catch (junctionError) {
          if (!["EACCES", "EPERM", "ENOSYS"].includes(junctionError?.code)) throw junctionError;
          t.diagnostic(`reparse-entry assertion skipped: file=${error.code}, junction=${junctionError.code}`);
        }
      } else t.diagnostic(`reparse-entry assertion skipped: ${error.code}`);
    }
    if (linkCreated) {
      try {
        const beforeUnsupported = await readFile(paths.reference, "utf8");
        await assert.rejects(maintainPackage(root, { operations: [{
          type: "replace-artifact", kind: "reference", path: "references/context.md", profile: "p2",
          expected_hash: sha256(beforeUnsupported), content: beforeUnsupported
        }] }, { repeats: 1 }), /Unsupported package entry references\/purpose-link\.md: symbolic link or junction/);
        assert.equal(await readFile(paths.reference, "utf8"), beforeUnsupported);
      } finally {
        await unlink(linkPath);
      }
    }
  });

  const beforeLaterFailure = await treeFingerprint(root);
  await assert.rejects(maintainPackage(root, { operations: [
    { type: "replace-artifact", kind: "reference", path: "references/context.md", profile: "p2", expected_hash: sha256(current.reference), content: `${current.reference}\nnot-installed\n` },
    { type: "replace-artifact", kind: "collector", path: "collectors/index.mjs", profile: "p2", expected_hash: `sha256:${"0".repeat(64)}`, content: current.collector }
  ] }, { repeats: 1 }), /current expected_hash/);
  assert.equal(await treeFingerprint(root), beforeLaterFailure);

  const legacySource = `${current.spec}\n// legacy replace-spec compatibility\n`;
  const legacy = await maintainPackage(root, { operations: [{ type: "replace-spec", expected_hash: sha256(current.spec), source: legacySource }] }, { repeats: 1 });
  assert.equal(await readFile(paths.spec, "utf8"), legacySource);
  assert.deepEqual(legacy.artifact_receipts.map(({ kind, path }) => ({ kind, path })), [{ kind: "spec", path: "spec.mjs" }]);
  await assert.rejects(maintainPackage(root, { operations: [{ type: "replace-spec", expected_hash: `sha256:${"0".repeat(64)}`, source: legacySource }] }, { repeats: 1 }), /replace-spec requires the current expected_hash/);

  const referenceBeforeConflict = await readFile(paths.reference, "utf8");
  await assert.rejects(maintainPackage(root, {
    operations: [{ type: "replace-artifact", kind: "reference", path: "references/context.md", profile: "p2", expected_hash: sha256(referenceBeforeConflict), content: `${referenceBeforeConflict}\ntransaction candidate\n` }]
  }, {
    repeats: 1,
    beforeInstall: async () => writeFile(join(root, "concurrent-owner.txt"), "preserve concurrent owner\n", "utf8")
  }), /changed while maintenance was running/);
  assert.equal(await readFile(paths.reference, "utf8"), referenceBeforeConflict);
  assert.equal(await readFile(join(root, "concurrent-owner.txt"), "utf8"), "preserve concurrent owner\n");
});

test("semantic diff reports direct and branch effect argument changes without changing legacy verb summaries", async (t) => {
  const base = await makeTestDir("semantic-effect-plans");
  t.after(() => removeTestDir(base));
  const root = join(base, "skill");
  const intent = await readJson(join(ROOT, "fixtures", "intents", "p2.json"));
  await generatePackage({ intent, output: root });
  const specPath = join(root, "spec.mjs");
  const generated = await readFile(specPath, "utf8");
  const baseline = generated
    .replace("export const STAGES = [\n", "export const STAGES = [\n  { id: \"prepare\", reads: [], done: s => true, record: { kind: \"receipt\", message: \"prepare\" }, effects: [[\"RUN\", { action: \"prepare\", mode: \"one\" }], \"NEXT\"], body: \"stage: operate\" },\n")
    .replace('{ template: "result" }', '{ template: "result", channel: "one" }');
  await writeFile(specPath, baseline, "utf8");
  const before = await snapshotContract(root);
  await writeFile(specPath, baseline.replace('mode: "one"', 'mode: "two"').replace('channel: "one"', 'channel: "two"'), "utf8");
  const after = await snapshotContract(root);
  const report = semanticDiff(before, after);
  assert.deepEqual(report.groups.stages.map((item) => item.id).sort(), ["operate", "prepare"]);
  const prepare = report.groups.stages.find((item) => item.id === "prepare");
  const operate = report.groups.stages.find((item) => item.id === "operate");
  assert.deepEqual(prepare.before.effects, ["RUN", "NEXT"]);
  assert.deepEqual(prepare.after.effects, ["RUN", "NEXT"]);
  assert.equal(prepare.before.effect_plans.default[0][1].mode, "one");
  assert.equal(prepare.after.effect_plans.default[0][1].mode, "two");
  assert.equal(operate.before.effect_plans.branches.ready[0][1].channel, "one");
  assert.equal(operate.after.effect_plans.branches.ready[0][1].channel, "two");
});

test("P0 and P1 maintenance regenerates intent projections without replacing authored helpers", async (t) => {
  const base = await makeTestDir("simple-maintenance");
  t.after(() => removeTestDir(base));

  const p0 = join(base, "p0");
  const p0Intent = await readJson(join(ROOT, "fixtures", "intents", "p0.json"));
  p0Intent.judgment_points = [{ id: "old-topic", when: "The old condition applies.", points: ["Use the old guidance."] }];
  await generatePackage({ intent: p0Intent, output: p0 });
  const updatedTopics = [{ id: "new-topic", when: "The new condition applies.", points: ["Use the new guidance."] }];
  const report = await maintainPackage(p0, {
    id: "replace-guidance-topic",
    intent: "Replace one conditional judgment topic.",
    operations: [{ type: "update-intent", patch: { judgment_points: updatedTopics } }]
  });
  assert.equal(report.schema, "skill-rails/simple-maintenance-report/1");
  assert.deepEqual(report.changed_fields, ["judgment_points"]);
  assert.equal(await exists(join(p0, "references", "guidance", "old-topic.md")), false);
  assert.equal(await exists(join(p0, "references", "guidance", "new-topic.md")), true);
  assert.equal((await lintSimpleSkill(p0)).ok, true);
  const maintainedLedger = await readJson(join(p0, ".skill-rails", "obligation-ledger.json"));
  assert.equal(maintainedLedger.intent_hash, sha256(await readJson(join(p0, ".skill-rails", "intent.json"))));

  const p1 = join(base, "p1");
  const p1Intent = await readJson(join(ROOT, "fixtures", "intents", "p1.json"));
  await generatePackage({ intent: p1Intent, output: p1 });
  const helperPath = join(p1, "scripts", "run.mjs");
  const authoredHelper = "#!/usr/bin/env node\n// authored helper remains byte-identical\nprocess.stdout.write('ready\\n');\n";
  await writeFile(helperPath, authoredHelper, "utf8");
  await maintainPackage(p1, {
    id: "clarify-description",
    operations: [{ type: "update-intent", patch: { description: `${p1Intent.description} Use only with verified source facts.` } }]
  });
  assert.equal(await readFile(helperPath, "utf8"), authoredHelper);
  const maintainedP1Skill = await readFile(join(p1, "SKILL.md"), "utf8");
  assert.match(maintainedP1Skill, /If `node <this-skill>\/scripts\/run\.mjs` emits `SR_P1_SCAFFOLD`, authoring is incomplete/);
  assert.doesNotMatch(maintainedP1Skill, /Before first use, replace the marked P1 helper scaffold/);
  assert.equal((await lintSimpleSkill(p1)).ok, true);

  const beforeUnsupported = sha256(await readFile(join(p0, "SKILL.md")));
  await assert.rejects(maintainPackage(p0, { operations: [{ type: "replace-resource", path: "references/x.md", content: "x" }] }), /SR_SIMPLE_MAINTAIN_OPERATION/);
  assert.equal(sha256(await readFile(join(p0, "SKILL.md"))), beforeUnsupported);

  const skillPath = join(p0, "SKILL.md");
  const currentIntent = await readJson(join(p0, ".skill-rails", "intent.json"));
  await writeFile(skillPath, (await readFile(skillPath, "utf8")).replace(/\n/g, "\r\n"), "utf8");
  await maintainPackage(p0, { operations: [{ type: "update-intent", patch: { problem: currentIntent.problem } }] });
  const canonicalSkill = await readFile(skillPath, "utf8");
  await writeFile(skillPath, `${canonicalSkill}\n## Hand-authored note\n\nPreserve me.\n`, "utf8");
  await assert.rejects(maintainPackage(p0, {
    operations: [{ type: "update-intent", patch: { problem: "A clarified canonical problem." } }]
  }), /SR_SIMPLE_OWNERSHIP.*SKILL\.md/);
  assert.match(await readFile(skillPath, "utf8"), /Preserve me/);
  await writeFile(skillPath, canonicalSkill, "utf8");

  const autoP0 = join(base, "auto-p0");
  await generatePackage({ intent: await readJson(join(ROOT, "fixtures", "intents", "p0.json")), output: autoP0 });
  const beforeIntent = await readFile(join(autoP0, ".skill-rails", "intent.json"), "utf8");
  await assert.rejects(maintainPackage(autoP0, {
    operations: [{ type: "update-intent", patch: { deterministic_helpers: ["a newly required helper"] } }]
  }), /SR_PROFILE_CHANGE/);
  assert.equal(await readFile(join(autoP0, ".skill-rails", "intent.json"), "utf8"), beforeIntent);
});

test("P2 generation seeds one portable purpose owner and withholds credit for an inferred purpose", async (t) => {
  const base = await makeTestDir("purpose-owner");
  t.after(() => removeTestDir(base));

  const root = join(base, "generated");
  const intent = await readJson(join(ROOT, "fixtures", "intents", "p2.json"));
  await generatePackage({ intent, output: root });
  assert.equal(await exists(join(root, "references", "purpose.md")), false, "generation must not seed a twin of the body purpose");
  const spec = await readFile(join(root, "spec.mjs"), "utf8");
  assert.match(spec, /export const READ_FIRST = \[\{ body: "why: purpose" \}\];/);
  const ledger = await readJson(join(root, ".skill-rails", "obligation-ledger.json"));
  const authored = ledger.atoms.find((atom) => atom.source === "intent.problem");
  assert.deepEqual(authored.targets, ["body:why: purpose"], "an authored purpose projects into one owner");

  // The library path, not only the migrate CLI, must withhold credit for a machine-inferred purpose.
  const source = join(base, "prose");
  await mkdir(source, { recursive: true });
  // Deliberately free of conditional wording so the auto profile lands on P0.
  await writeFile(join(source, "SKILL.md"), "---\nname: inferred-source\ndescription: Use inferred-source to keep public writing plain and direct.\n---\n\n# Inferred\n\nPrefer plain words over jargon. Keep sentences short. Name the subject first.\n", "utf8");
  const inspection = await inspectProseSkill(source);
  const inferred = await inferMigrationIntent(source, inspection);
  assert.doesNotMatch(inferred.problem, /[A-Za-z]:\\|\//, "an inferred purpose carries no host path");

  const migrated = join(base, "migrated");
  await generatePackage({ intent: { ...inferred, state_dependent_behaviors: ["Tagging is blocked until the suite passes."] }, output: migrated, requestedProfile: "p2", finalize: (stage) => writeMigrationLedger(stage, inspection) });
  const migratedLedger = await readJson(join(migrated, ".skill-rails", "obligation-ledger.json"));
  const inferredAtom = migratedLedger.atoms.find((atom) => atom.source === "intent.problem");
  assert.equal(inferredAtom.disposition, "review-required", "an inferred P2 purpose is a guess, not an approved projection");
  assert.equal(typeof migratedLedger.migration.source_root, "string", "provenance stays in the ledger");

  // P0/P1 regenerate and ownership-check their projections, so a demoted intent atom is invalid there.
  const simple = join(base, "simple");
  await generatePackage({ intent: inferred, output: simple, finalize: (stage) => writeMigrationLedger(stage, inspection) });
  const simpleLedger = await readJson(join(simple, ".skill-rails", "obligation-ledger.json"));
  assert.equal(simpleLedger.profile, "p0", "a purely judgmental source infers a simple profile");
  assert.equal(simpleLedger.atoms.find((atom) => atom.source === "intent.problem").disposition, "projected");
  assert.equal((await lintSimpleSkill(simple)).ok, true, "an inferred simple migration must not ship lint-invalid");
});

test("build verifies every declared package file the runtime tells the model to read", async (t) => {
  const base = await makeTestDir("declared-file-checks");
  t.after(() => removeTestDir(base));
  const root = join(base, "skill");
  const intent = await readJson(join(ROOT, "fixtures", "intents", "p2.json"));
  await generatePackage({ intent, output: root, finalize: async (stage) => buildP2(stage, { repeats: 1 }) });
  const specPath = join(root, "spec.mjs");
  const bodyPath = join(root, "body.md");
  const original = await readFile(specPath, "utf8");
  const originalBody = await readFile(bodyPath, "utf8");
  assert.deepEqual((await validateFull(root)).diagnostics, [], "the generated package is clean before mutation");

  const diagnose = async (spec, body = originalBody) => {
    await writeFile(specPath, spec, "utf8");
    await writeFile(bodyPath, body, "utf8");
    const result = await validateFull(root);
    await writeFile(specPath, original, "utf8");
    await writeFile(bodyPath, originalBody, "utf8");
    return result.diagnostics;
  };
  const READ_FIRST_LINE = 'export const READ_FIRST = [{ body: "why: purpose" }];';
  const READY_PLAN = 'ready: [["REPORT", { template: "result" }], "DONE"]';
  const withRole = (effects) => original.replace("export const ROLES = {};",
    `export const ROLES = { checker: { body: "role: checker", effects: ${effects} } };`);
  const roleBody = `${originalBody}\n## role: checker\n\nThe checker reports what the evidence already shows.\n`;

  const missingReadFirst = await diagnose(original.replace(READ_FIRST_LINE,
    'export const READ_FIRST = [{ body: "why: purpose", path: "references/absent.md" }];'));
  assert.equal(missingReadFirst.some((item) => item.code === "L7" && item.pointer === "READ_FIRST.0.path"), true, "a missing READ_FIRST file fails the build, not the first enter");

  const escaping = await diagnose(original.replace(READ_FIRST_LINE,
    'export const READ_FIRST = [{ body: "why: purpose", path: "../outside.md" }];'));
  assert.equal(escaping.some((item) => item.code === "L7" && /portable/.test(item.message)), true, "a READ_FIRST path may not leave the package");

  // An effect argument is rendered into the model's instruction verbatim, so no verb reserves `path`
  // as a package file. Requiring one rejected specs version 5 accepts, on every verb including READ.
  for (const plan of [
    'ready: [["READ", { path: "the ticket named in the request" }], ["REPORT", { template: "result" }], "DONE"]',
    'ready: [["READ", { artifact: "result", path: "origin.sourcePath" }], ["REPORT", { template: "result" }], "DONE"]',
    'ready: [["RUN", { path: "tools/project-local-runner" }], ["REPORT", { template: "result" }], "DONE"]'
  ]) {
    const diagnostics = await diagnose(original.replace(READY_PLAN, plan));
    assert.deepEqual(diagnostics.filter((item) => item.pointer.endsWith(".path")), [], `an effect path argument keeps its version-5 freedom: ${plan}`);
  }

  // A role names its own inputs and is rendered standalone, so its effect arguments are not resolved
  // against this package's ARTIFACTS namespace.
  const roleInput = await diagnose(withRole('[["READ", { artifact: "brief" }]]'), roleBody);
  assert.deepEqual(roleInput.filter((item) => item.pointer.startsWith("ROLES.checker.effects")), [], "a role effect may name its own input");
});

test("maintenance receipts report every maintainable resource change, not only READ_FIRST files", async (t) => {
  const base = await makeTestDir("receipt-coverage");
  t.after(() => removeTestDir(base));
  const root = join(base, "skill");
  const intent = await readJson(join(ROOT, "fixtures", "intents", "p2.json"));
  // A reference no READ_FIRST entry names: the surface a receipt used to report as unchanged.
  await generatePackage({ intent, output: root, finalize: async (stage) => {
    await writeFile(join(stage, "references", "notes.md"), "# Notes\n\nOriginal guidance.\n", "utf8");
    return buildP2(stage, { repeats: 1 });
  } });

  const before = await snapshotContract(root);
  await writeFile(join(root, "references", "notes.md"), "# Notes\n\nRewritten guidance.\n", "utf8");
  const report = semanticDiff(before, await snapshotContract(root));
  assert.equal(report.any_changed, true, "a real content change may never be reported as no change");
  assert.equal(report.source_changes.context, true);
  assert.deepEqual(report.groups.references.map((item) => ({ id: item.id, change: item.change })), [{ id: "references/notes.md", change: "modified" }]);
});

test("a resource root that is a regular file is no resources, not a crash", async (t) => {
  const base = await makeTestDir("resource-root-file");
  t.after(() => removeTestDir(base));
  const root = join(base, "skill");
  const intent = await readJson(join(ROOT, "fixtures", "intents", "p2.json"));
  await generatePackage({ intent, output: root, finalize: async (stage) => buildP2(stage, { repeats: 1 }) });
  // Version 5 does not reserve these names for directories. Traversing them blindly turned a legal
  // package shape into an ENOTDIR failure before any maintenance operation could run.
  await rm(join(root, "references"), { recursive: true, force: true });
  await writeFile(join(root, "references"), "not a directory\n", "utf8");
  const snapshot = await snapshotContract(root);
  assert.deepEqual(Object.keys(snapshot.references).filter((key) => key.startsWith("references")), [], "a non-directory resource root contributes no resources");
});

test("runtime state may not land inside the observed project", async (t) => {
  const base = await makeTestDir("external-state");
  t.after(() => removeTestDir(base));
  const skill = join(base, "skill");
  const project = join(base, "project");
  await mkdir(project, { recursive: true });
  // The rule protected the installed package and left the project unguarded, so a consumer following
  // "outside the installed skill" literally dropped untracked run state into the repository it observed.
  await assert.rejects(
    assertExternalStateDir(skill, join(project, ".traces"), project),
    (error) => error.code === "SR_STATE_INSIDE_PROJECT",
    "a trace directory inside the observed project is refused");
  await assert.rejects(
    assertExternalStateDir(skill, join(skill, ".traces"), project),
    (error) => error.code === "SR_STATE_INSIDE_SKILL",
    "the installed package stays protected");
  await assertExternalStateDir(skill, join(base, "outside"), project);
  // Callers that do not know a project keep the previous contract exactly.
  await assertExternalStateDir(skill, join(project, ".traces"));

  // A lexical check alone is a check a junction walks around, and the junction is the shape a
  // consumer actually produces when a scratch path is linked back into the repository.
  const linked = join(base, "linked-traces");
  await mkdir(join(project, ".traces"), { recursive: true });
  await symlink(join(project, ".traces"), linked, "junction");
  await assert.rejects(
    assertExternalStateDir(skill, linked, project),
    (error) => error.code === "SR_STATE_INSIDE_PROJECT",
    "a junction into the observed project is refused on its target, not its name");
});

test("a role is a resolvable landing place, not a crash", async (t) => {
  const base = await makeTestDir("role-locator");
  t.after(() => removeTestDir(base));
  const root = join(base, "skill");
  const intent = await readJson(join(ROOT, "fixtures", "intents", "p2.json"));
  await generatePackage({ intent, output: root, finalize: async (stage) => buildP2(stage, { repeats: 1 }) });

  const specPath = join(root, "spec.mjs");
  const bodyPath = join(root, "body.md");
  const spec = await readFile(specPath, "utf8");
  const body = await readFile(bodyPath, "utf8");
  await writeFile(specPath, spec.replace("export const ROLES = {};",
    'export const ROLES = { checker: { body: "role: checker", effects: [["REPORT", { template: "result" }]] } };')
    .replace("export const TABLES = {};",
      'export const TABLES = { evidence: { exclusive: true, rows: [{ state: "only", reads: [], when: () => true }] } };'), "utf8");
  await writeFile(bodyPath, body + "\n## role: checker\n\nThe checker reports what the evidence already shows.\n", "utf8");

  const ledgerPath = join(root, ".skill-rails", "obligation-ledger.json");
  const ledger = await readJson(ledgerPath);
  const atom = ledger.atoms.find((item) => item.id === "problem-001");
  // Naming a declared role as the place an obligation landed used to throw instead of resolving,
  // which made every role an unusable target rather than a checked one.
  atom.targets = ["spec:ROLES/checker"];
  atom.evidence = ["spec:ROLES/checker"];
  await writeFile(ledgerPath, JSON.stringify(ledger, null, 2) + "\n", "utf8");

  const resolved = await validateFull(root);
  assert.deepEqual(resolved.diagnostics.filter((item) => item.code === "L16"), [], "a declared role resolves as a landing place");

  atom.targets = ["spec:ROLES/absent"];
  atom.evidence = ["spec:ROLES/absent"];
  await writeFile(ledgerPath, JSON.stringify(ledger, null, 2) + "\n", "utf8");
  const missing = await validateFull(root);
  assert.equal(missing.diagnostics.some((item) => item.code === "L16" && /does not resolve/.test(item.message)), true,
    "an undeclared role is reported as an unresolved locator, not accepted and not a crash");

  // A locator addresses one thing. A trailing segment used to be ignored, so a mistyped locator
  // resolved as though it named its parent and the atom kept credit it had not earned.
  atom.targets = ["spec:ROLES/checker/typo"];
  atom.evidence = ["spec:ROLES/checker/typo"];
  await writeFile(ledgerPath, JSON.stringify(ledger, null, 2) + "\n", "utf8");
  const trailing = await validateFull(root);
  assert.equal(trailing.diagnostics.some((item) => item.code === "L16" && /does not resolve/.test(item.message)), true,
    "a trailing segment does not resolve to the thing it was appended to");

  // A table row is the one locator that legitimately carries three segments, and it is the shape a
  // real ledger cites most: getting its arity wrong rejects every table citation rather than a typo.
  const unresolved = async (locator) => {
    atom.targets = [locator];
    atom.evidence = [locator];
    await writeFile(ledgerPath, JSON.stringify(ledger, null, 2) + "\n", "utf8");
    const result = await validateFull(root);
    return result.diagnostics.some((item) => item.code === "L16" && item.message.endsWith(locator));
  };
  assert.equal(await unresolved("spec:TABLES/evidence/only"), false, "a declared table row resolves");
  assert.equal(await unresolved("spec:TABLES/evidence"), true, "a table names more than one row, so it is not a landing place");
  assert.equal(await unresolved("spec:TABLES/evidence/only/typo"), true, "a trailing segment on a table row does not resolve either");
});

async function treeFingerprint(root) {
  const files = await listFiles(root);
  return sha256(await Promise.all(files.map(async (path) => `${relative(root, path).replace(/\\/g, "/")}:${await hashFile(path)}`)));
}
