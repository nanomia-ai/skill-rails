import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { generatePackage } from "../scripts/lib/generator.mjs";
import { buildP2 } from "../scripts/lib/build-core.mjs";
import { inspectProseSkill, inferMigrationIntent, writeMigrationLedger } from "../scripts/lib/migration.mjs";
import { maintainPackage } from "../scripts/lib/maintenance.mjs";
import { lintSimpleSkill } from "../scripts/lib/simple-lint.mjs";
import { exists, readJson } from "../scripts/lib/io.mjs";
import { sha256 } from "../scripts/runtime/hash.mjs";
import { parseArgs } from "../scripts/lib/args.mjs";
import { validateFull } from "../scripts/runtime/validator.mjs";
import { ROOT, makeTestDir, removeTestDir } from "./helpers.mjs";

test("authoring CLIs fail closed on unknown options before running work", () => {
  const result = spawnSync(process.execPath, [join(ROOT, "scripts", "eval.mjs"), "--help", "true"], {
    cwd: ROOT, encoding: "utf8", windowsHide: true
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown option: --help/);
  assert.equal(result.stdout, "");
  assert.throws(() => parseArgs(["--dry-run", "false"], { booleans: ["dry-run"] }), /separate value is forbidden/);
});

test("creator self-evaluation works without generated authoring state", () => {
  const result = spawnSync(process.execPath, [join(ROOT, "scripts", "eval.mjs"), "--skill", ROOT], {
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
  const intent = await readJson(join(ROOT, "templates", "intent-brief.json"));
  for (const [field, value] of Object.entries(intent)) if (Array.isArray(value)) assert.deepEqual(value, [], `${field} must start empty`);
});

test("README guidance remains conditional and reachable from agent entry points", async () => {
  const [skill, workflow, agents, claude, guide] = await Promise.all([
    readFile(join(ROOT, "SKILL.md"), "utf8"),
    readFile(join(ROOT, "references", "authoring-workflow.md"), "utf8"),
    readFile(join(ROOT, "AGENTS.md"), "utf8"),
    readFile(join(ROOT, "CLAUDE.md"), "utf8"),
    readFile(join(ROOT, "references", "readme-authoring.md"), "utf8")
  ]);
  assert.match(skill, /When the user asks to create or revise a skill README/);
  assert.match(skill, /Do not create a README merely because the guide exists/);
  for (const entry of [skill, workflow, agents, claude]) assert.match(entry, /readme-authoring\.md/);
  for (const heading of ["The first-screen contract", "Make mechanization visible", "Preserve user voice and authority", "Authoring and review procedure"]) {
    assert.match(guide, new RegExp(`## ${heading}`));
  }
});

test("portable creator commands use only package-local runtime dependencies", async (t) => {
  const base = await makeTestDir("thin-dependency-boundary");
  t.after(() => removeTestDir(base));
  const loader = pathToFileURL(join(ROOT, "fixtures", "reject-external-runtime-dependencies-loader.mjs")).href;
  const run = (script, args) => spawnSync(process.execPath, ["--experimental-loader", loader, join(ROOT, "scripts", script), ...args], { cwd: ROOT, encoding: "utf8", windowsHide: true });
  for (const profile of ["p0", "p1", "p2"]) {
    const result = run("init.mjs", ["--intent", join(ROOT, "fixtures", "intents", `${profile}.json`), "--out", join(base, profile)]);
    assert.equal(result.status, 0, result.stderr);
  }
  for (const [script, args, expected] of [["lint.mjs", ["--self"], 0], ["build.mjs", ["--self"], 0], ["eval.mjs", ["--skill", ROOT], 1]]) {
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
