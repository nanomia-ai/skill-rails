import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { generatePackage } from "../scripts/lib/generator.mjs";
import { buildP2 } from "../scripts/lib/build-core.mjs";
import { inspectProseSkill, inferMigrationIntent, writeMigrationLedger } from "../scripts/lib/migration.mjs";
import { maintainPackage } from "../scripts/lib/maintenance.mjs";
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

test("creator generation paths use only package-local runtime dependencies", async (t) => {
  const base = await makeTestDir("thin-dependency-boundary");
  t.after(() => removeTestDir(base));
  const loader = pathToFileURL(join(ROOT, "fixtures", "reject-p2-dependencies-loader.mjs")).href;
  const run = (script, args) => spawnSync(process.execPath, ["--experimental-loader", loader, join(ROOT, "scripts", script), ...args], { cwd: ROOT, encoding: "utf8", windowsHide: true });
  for (const profile of ["p0", "p1", "p2"]) {
    const result = run("init.mjs", ["--intent", join(ROOT, "fixtures", "intents", `${profile}.json`), "--out", join(base, profile)]);
    assert.equal(result.status, 0, result.stderr);
  }
  for (const [script, args, expected] of [["lint.mjs", ["--self"], 0], ["build.mjs", ["--self"], 0], ["eval.mjs", ["--skill", ROOT], 1]]) {
    const result = run(script, args);
    assert.equal(result.status, expected, result.stderr);
    assert.doesNotMatch(result.stderr, /P2 dependency loaded/);
  }
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
