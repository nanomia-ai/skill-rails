import { copyFile, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { copyTree, exists, listFiles, readJson, replaceDirectoryAtomic, writeTextAtomic } from "./io.mjs";
import { assertP2PackageGitAttributes, writeGeneratedSkillBootstrap } from "./generator.mjs";
import { createManifest, detectGeneratedEdits, GENERATED_PACKAGE_FILES, readManifest, writeManifest } from "../runtime/manifest.mjs";
import { hashFile, sha256 } from "../runtime/hash.mjs";
import { loadAuthoringSkill, simulateSkill } from "../runtime/api.mjs";
import { runMutationSuite } from "./mutation-suite.mjs";
import { nestFlat } from "../runtime/collectors.mjs";

const AUTHORING_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SOURCE_RUNTIME = join(AUTHORING_ROOT, "scripts", "runtime");
const GENERATED_RUNTIME = join("scripts", "skill-rails");

export async function buildP2(skillRoot, options = {}) {
  const root = resolve(skillRoot);
  if (!(await exists(join(root, "spec.mjs")))) throw new Error(`P2 build requires spec.mjs: ${root}`);
  const hasManifest = await exists(join(root, ".generated.json"));
  const manifest = hasManifest ? await readManifest(root) : null;
  await assertP2PackageGitAttributes(root, {
    manifestOwned: Boolean(manifest?.generated_files?.[".gitattributes"]),
    allowOwnershipTransfer: Boolean(options.allowGeneratedEdits)
  });
  if (hasManifest && !options.allowGeneratedEdits) {
    const edits = await detectGeneratedEdits(root);
    if (edits.length > 0) throw new Error(`Generated files were edited manually:\n${edits.map((item) => `- ${item.path}: ${item.status}`).join("\n")}\nChange canonical sources or pass --repair-generated explicitly.`);
  }
  await assertRegularPackage(root);
  const before = await packageFingerprint(root);
  const scratch = join(dirname(root), `.${basename(root)}.build-${randomUUID()}`);
  await mkdir(scratch, { recursive: false });
  try {
    await copyTree(root, scratch, { filter: (local) => ![".git", "node_modules"].includes(local.split("/")[0]) });
    const result = await buildP2InPlace(scratch, options);
    const current = await packageFingerprint(root);
    if (current !== before) throw new Error("Skill package changed while the isolated build was running; no generated output was installed.");
    await installGeneratedOutputs(scratch, root);
    return { ...result, root, manifest: await readJson(join(root, ".generated.json")) };
  } finally {
    await rm(scratch, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
}

async function buildP2InPlace(root, options = {}) {

  const intent = await loadIntent(root);
  await writeGeneratedSkillBootstrap(root, intent);
  await materializeRuntime(root);
  await copyPublicSchemas(root);

  const isolated = await isolatedLint(root);
  if (!isolated.ok) throw new Error(`L-structural failed before L-full build:\n${isolated.diagnostics.map((item) => `${item.code} ${item.pointer}: ${item.message}`).join("\n")}`);
  const mutationEvidence = options.skipMutations ? { skipped: true, reason: "internal-test-only" } : await runMutationSuite(root);
  const fixtureEvidence = await runFixtureSuite(root, { repeats: options.repeats ?? 200 });
  const formatEvidence = await runFormatSuite(root);

  const generatedFiles = [
    ...GENERATED_PACKAGE_FILES,
    ...((await listFiles(join(root, GENERATED_RUNTIME))).map((path) => relative(root, path).replace(/\\/g, "/")))
  ];
  const { predicate_evaluation_p99_ms: _observedP99, ...stableFixtureEvidence } = fixtureEvidence;
  stableFixtureEvidence.predicate_performance = {
    status: "pass",
    limit_ms: fixtureEvidence.predicate_evaluation_limit_ms
  };
  const manifest = await createManifest(root, {
    skillId: isolated.spec?.SPEC?.id ?? intent.name,
    runtimeDir: join(root, GENERATED_RUNTIME),
    generatedFiles,
    evidence: { lint: "L-full:pass", mutations: mutationEvidence, fixtures: stableFixtureEvidence, formats: formatEvidence, isolated_import: true, build_timestamp: null }
  });
  await writeManifest(root, manifest);
  return { root, manifest, validation: isolated, fixtures: fixtureEvidence };
}

async function installGeneratedOutputs(sourceRoot, targetRoot) {
  const backup = join(dirname(targetRoot), `.${basename(targetRoot)}.generated-backup-${randomUUID()}`);
  const runtimeLocal = "scripts/skill-rails";
  const manifestLocal = ".generated.json";
  await mkdir(backup, { recursive: false });
  const existed = new Set();
  let installStarted = false;
  try {
    for (const local of [...GENERATED_PACKAGE_FILES, manifestLocal]) {
      const target = join(targetRoot, ...local.split("/"));
      if (await exists(target)) {
        const backupPath = join(backup, ...local.split("/"));
        await mkdir(dirname(backupPath), { recursive: true });
        await copyFile(target, backupPath);
        existed.add(local);
      }
    }
    const runtimeTarget = join(targetRoot, ...runtimeLocal.split("/"));
    if (await exists(runtimeTarget)) {
      await copyTree(runtimeTarget, join(backup, ...runtimeLocal.split("/")));
      existed.add(runtimeLocal);
    }

    installStarted = true;
    for (const local of GENERATED_PACKAGE_FILES) {
      await writeTextAtomic(join(targetRoot, ...local.split("/")), await readFile(join(sourceRoot, ...local.split("/")), "utf8"));
    }
    await replaceDirectoryAtomic(runtimeTarget, async (stage) => copyTree(join(sourceRoot, ...runtimeLocal.split("/")), stage));
    // The manifest is the commit marker: old readers fail closed during the
    // update and new readers can succeed only after every generated file lands.
    await writeTextAtomic(join(targetRoot, manifestLocal), await readFile(join(sourceRoot, manifestLocal), "utf8"));
  } catch (error) {
    if (installStarted) {
      for (const local of GENERATED_PACKAGE_FILES) await restoreFile(local);
      if (existed.has(runtimeLocal)) await replaceDirectoryAtomic(join(targetRoot, ...runtimeLocal.split("/")), async (stage) => copyTree(join(backup, ...runtimeLocal.split("/")), stage));
      else await rm(join(targetRoot, ...runtimeLocal.split("/")), { recursive: true, force: true });
      await restoreFile(manifestLocal);
    }
    throw error;
  } finally {
    await rm(backup, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }

  async function restoreFile(local) {
    const target = join(targetRoot, ...local.split("/"));
    if (existed.has(local)) await writeTextAtomic(target, await readFile(join(backup, local), "utf8"));
    else await rm(target, { force: true });
  }
}

async function assertRegularPackage(root, directory = root) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if ([".git", "node_modules"].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await assertRegularPackage(root, path);
    else if (!entry.isFile()) {
      const error = new Error(`P2 packages must be self-contained and may not contain symlinks, junctions, or special entries: ${relative(root, path)}`);
      error.code = "SR_PACKAGE_SYMLINK";
      throw error;
    }
  }
}

async function packageFingerprint(root, directory = root) {
  const entries = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if ([".git", "node_modules"].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    const local = relative(root, path).replace(/\\/g, "/");
    if (entry.isDirectory()) entries.push(...await packageFingerprintEntries(root, path));
    else if (entry.isFile()) entries.push(`${local}:${await hashFile(path)}`);
    else entries.push(`${local}:special`);
  }
  return sha256(entries);
}

async function packageFingerprintEntries(root, directory) {
  const entries = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if ([".git", "node_modules"].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    const local = relative(root, path).replace(/\\/g, "/");
    if (entry.isDirectory()) entries.push(...await packageFingerprintEntries(root, path));
    else if (entry.isFile()) entries.push(`${local}:${await hashFile(path)}`);
    else entries.push(`${local}:special`);
  }
  return entries;
}

export async function materializeRuntime(skillRoot) {
  const root = resolve(skillRoot);
  const target = join(root, GENERATED_RUNTIME);
  await replaceDirectoryAtomic(target, async (stage) => {
    await copyTree(SOURCE_RUNTIME, stage, { filter: (local) => !["cli.mjs"].includes(local) });
    for (const path of await listFiles(stage)) await writeTextAtomic(path, canonicalGeneratedText(await readFile(path, "utf8")));
    await writeTextAtomic(join(stage, "cli.mjs"), await generatedCliSource());
    for (const name of ["run", "lint", "trace", "align"]) {
      await writeTextAtomic(join(stage, `${name}.mjs`), `#!/usr/bin/env node\n// @generated by Skill Rails\nimport { main } from "./cli.mjs";\nprocess.exitCode = await main(process.argv.slice(2));\n`);
    }
  });
  return target;
}

async function generatedCliSource() {
  return canonicalGeneratedText(await readFile(join(SOURCE_RUNTIME, "cli.mjs"), "utf8"));
}

async function copyPublicSchemas(root) {
  await mkdir(join(root, "schemas"), { recursive: true });
  for (const name of ["decision.schema.json", "trace-event.schema.json"]) {
    await writeTextAtomic(join(root, "schemas", name), canonicalGeneratedText(await readFile(join(AUTHORING_ROOT, "schemas", name), "utf8")));
  }
}

function canonicalGeneratedText(source) { return String(source).replace(/\r\n?/g, "\n"); }

async function isolatedLint(root) {
  const lintPath = join(AUTHORING_ROOT, "scripts", "lint.mjs");
  const result = await runNode([lintPath, "--skill", root, "--full", "--json"]);
  let parsed;
  try { parsed = JSON.parse(result.stdout); }
  catch { throw new Error(`Isolated lint returned invalid JSON.\nstdout: ${result.stdout}\nstderr: ${result.stderr}`); }
  if (result.code !== 0 && parsed.ok !== false) throw new Error(`Isolated lint failed: ${result.stderr || result.stdout}`);
  return parsed;
}

export async function runFixtureSuite(root, options = {}) {
  const fixtures = await readJson(join(root, "fixtures", "scenarios.json"));
  const loaded = await loadAuthoringSkill(root, join(root, GENERATED_RUNTIME));
  const results = [];
  for (const fixture of fixtures) {
    const output = await simulateSkill({ skillRoot: root, fixture, runtimeDir: join(root, GENERATED_RUNTIME) });
    assertFixture(fixture, output.decision);
    const actualCoverage = coverageFor(loaded.spec, fixture, output.decision);
    for (const claim of fixture.cover ?? []) if (!actualCoverage.has(claim)) throw new Error(`Fixture ${fixture.id} claims coverage it did not execute: ${claim}. actual=${[...actualCoverage].join(",")}`);
    results.push({ id: fixture.id, decision_id: output.decision.decision_id });
  }
  const sample = fixtures[0];
  const ids = [];
  const predicateTimings = [];
  for (let index = 0; index < (options.repeats ?? 20); index += 1) {
    const output = await simulateSkill({ skillRoot: root, fixture: sample, runtimeDir: join(root, GENERATED_RUNTIME), predicateTimings });
    ids.push(output.decision.decision_id);
  }
  if (new Set(ids).size !== 1) throw new Error(`Determinism mismatch for fixture ${sample.id}.`);
  const sortedTimings = predicateTimings.toSorted((a, b) => a - b);
  const predicateP99Ms = sortedTimings.length ? sortedTimings[Math.max(0, Math.ceil(sortedTimings.length * 0.99) - 1)] : 0;
  const predicateP99LimitMs = options.predicateP99LimitMs ?? 50;
  if (predicateP99Ms >= predicateP99LimitMs) throw new Error(`Predicate evaluation p99 ${predicateP99Ms.toFixed(3)}ms exceeded ${predicateP99LimitMs}ms.`);
  return {
    passed: results.length,
    total: fixtures.length,
    deterministic_repeats: ids.length,
    mismatches: 0,
    predicate_evaluations: predicateTimings.length,
    predicate_evaluation_p99_ms: Number(predicateP99Ms.toFixed(6)),
    predicate_evaluation_limit_ms: predicateP99LimitMs
  };
}

async function runFormatSuite(root) {
  const loaded = await loadAuthoringSkill(root, join(root, GENERATED_RUNTIME));
  const results = [];
  for (const [id, format] of Object.entries(loaded.spec.FORMATS ?? {})) {
    for (let index = 0; index < 256; index += 1) {
      const values = Object.fromEntries(Object.entries(format.fields).map(([field, domain]) => [field, sampleDomain(domain, index)]));
      const rendered = format.render(values, { timestamp: `2026-08-23T00:00:${String(index % 60).padStart(2, "0")}Z` });
      if (typeof rendered !== "string") throw new Error(`Format ${id} rejected its generated valid sample ${index}.`);
      const parsed = format.parse(rendered);
      if (!parsed.ok || JSON.stringify(parsed.fields) !== JSON.stringify(values)) throw new Error(`Format ${id} round-trip mismatch at sample ${index}.`);
    }
    const first = Object.fromEntries(Object.entries(format.fields).map(([field, domain]) => [field, sampleDomain(domain, 0)]));
    const newlineField = Object.keys(format.fields).find((field) => typeof first[field] === "string");
    if (newlineField && typeof format.render({ ...first, [newlineField]: `${first[newlineField]}\nmutation` }, { timestamp: "2026-08-23T00:00:00Z" }) === "string") throw new Error(`Format ${id} accepted a multiline field.`);
    results.push({ id, round_trips: 256, crlf_rejected: Boolean(newlineField) });
  }
  return { passed: results.length, total: Object.keys(loaded.spec.FORMATS ?? {}).length, results };
}

function assertFixture(fixture, decision) {
  const expect = fixture.expect ?? {};
  for (const field of ["stage", "row", "status"]) if (Object.hasOwn(expect, field) && decision[field] !== expect[field]) throw new Error(`Fixture ${fixture.id}: expected ${field}=${expect[field]}, got ${decision[field]}`);
  if (Object.hasOwn(expect, "guard")) {
    const actual = decision.guard?.id ?? "none";
    if (actual !== expect.guard) throw new Error(`Fixture ${fixture.id}: expected guard=${expect.guard}, got ${actual}`);
  }
  if (expect.effects) {
    const actual = decision.effects.map((item) => Array.isArray(item) ? item[0] : item);
    if (JSON.stringify(actual) !== JSON.stringify(expect.effects)) throw new Error(`Fixture ${fixture.id}: expected effects ${JSON.stringify(expect.effects)}, got ${JSON.stringify(actual)}`);
  }
}

function coverageFor(spec, fixture, decision) {
  const coverage = new Set();
  const state = nestFlat({ ...(fixture.s ?? {}), ...(fixture.judged ?? {}), ...(fixture.decided ?? {}) });
  for (const guard of spec.GUARDS ?? []) {
    let matched = false; let bypassed = false;
    try { matched = guard.when(state) === true; bypassed = matched && guard.unless?.when(state) === true; } catch { /* invalid fixtures fail elsewhere */ }
    if (matched) coverage.add(`guard:${guard.id}`);
    if (bypassed) coverage.add(`unless:${guard.id}/${guard.unless.id}`);
    if (matched && !bypassed && guard.then !== "RESTRICT") break;
  }
  if (decision.stage) coverage.add(`stage:${decision.stage}`);
  if (decision.stage && decision.row) {
    const stage = (spec.STAGES ?? []).find((item) => item.id === decision.stage);
    if (stage?.table) {
      coverage.add(`row:${stage.table}/${decision.row}`);
      coverage.add(`branch:${stage.table}/${decision.row}`);
    } else coverage.add(`branch:${stage.id}/${decision.row}`);
  }
  return coverage;
}

function sampleDomain(domain, index) {
  if (Array.isArray(domain)) return domain[index % domain.length];
  if (domain && typeof domain === "object") return Object.fromEntries(Object.entries(domain).map(([key, child]) => [key, sampleDomain(child, index)]));
  if (domain.endsWith?.("|NONE") && index % 5 === 0) return "NONE";
  if (domain.endsWith?.("|NONE")) return sampleDomain(domain.slice(0, -5), index);
  if (domain.startsWith?.("list:[")) {
    const values = domain.slice(6, -1).split("|");
    if (index % 4 === 0) return [];
    if (index % 4 === 1) return [values[index % values.length]];
    return values.slice(0, Math.min(values.length, (index % values.length) + 1));
  }
  return {
    integer: index,
    hex40: (index % 16).toString(16).repeat(40),
    "card-number": `00.${index + 1}`,
    "card-list": `00.${index + 1}+01.${index + 1}`,
    path: `path-${index}`,
    text: ["", "unicode-한글", "quote-\"-slash-\\", "semicolon; next-field: value", "colon: value", "{{placeholder}}", "x".repeat(4096)][index % 7],
    json: [
      { index, value: "한글", nested: { label: "; next-field: value" } },
      [index, "quote-\"-slash-\\", { semicolon: "; field: value" }],
      `json-string-${index}; next-field: value`,
      null,
      index,
      index % 2 === 0
    ][index % 6]
  }[domain];
}

async function loadIntent(root) {
  const path = join(root, ".skill-rails", "intent.json");
  if (await exists(path)) return readJson(path);
  const source = await readFile(join(root, "spec.mjs"), "utf8");
  const id = source.match(/id:\s*["']([^"']+)["']/)?.[1] ?? "generated-skill";
  return { name: id, description: `Use ${id} when its verified stateful workflow applies.`, problem: `Execute ${id} without losing its declared state, order, and evidence rules.` };
}

function runNode(args) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, args, { cwd: AUTHORING_ROOT, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = ""; let stderr = "";
    child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolveResult({ code, stdout, stderr }));
  });
}
