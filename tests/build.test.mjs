import test from "node:test";
import assert from "node:assert/strict";
import { appendFile, cp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canonicalText, sha256 } from "../src/core/canonicalize.mjs";
import { coreCli, fileMap, repositoryRoot, runNode, temporary } from "./helpers.mjs";

const pilotSource = "domains/natural-language-pilot/skill-package.json";
const embeddedCoreFiles = [
  "contracts/build-receipt.schema.json",
  "contracts/observed-facts.schema.json",
  "contracts/packet-kernel.schema.json",
  "contracts/prepared-work.schema.json",
  "contracts/record-exchange.schema.json",
  "contracts/source-package.schema.json",
  "contracts/target.schema.json",
  "package.json",
  "src/core/build.mjs",
  "src/core/canonicalize.mjs",
  "src/core/check.mjs",
  "src/core/cli.mjs",
  "src/core/errors.mjs",
  "src/core/heading-index.mjs",
  "src/core/human-overview.mjs",
  "src/core/inspect.mjs",
  "src/core/paths.mjs",
  "src/core/validate.mjs",
  "src/runtime/common.mjs",
  "src/runtime/exchange.mjs",
  "src/runtime/initialize-record.mjs",
  "src/runtime/integrity.mjs",
  "src/runtime/prepare.mjs",
  "src/runtime/record.mjs",
  "src/runtime/run-check.mjs",
  "src/runtime/run-record.mjs",
  "src/runtime/run.mjs",
];

test("same source builds byte-identical standalone target trees", async (t) => {
  const root = await temporary(t, "double-build");
  const left = coreCli("build", "--source", pilotSource, "--out-root", join(root, "left"));
  const right = coreCli("build", "--source", pilotSource, "--out-root", join(root, "right"));
  assert.equal(left.status, 0, left.stderr || left.stdout);
  assert.equal(right.status, 0, right.stderr || right.stdout);
  const identity = ({ targetId, treeSha256 }) => ({ targetId, treeSha256 });
  assert.deepEqual(left.json.outputs.map(identity), right.json.outputs.map(identity));
  const leftFiles = await fileMap(join(root, "left", "skills", "natural-language-pilot-verify-next"));
  const rightFiles = await fileMap(join(root, "right", "skills", "natural-language-pilot-verify-next"));
  assert.deepEqual([...leftFiles.keys()], [...rightFiles.keys()]);
  for (const [path, bytes] of leftFiles) assert.deepEqual(bytes, rightFiles.get(path), path);
});

test("Product target builds standalone and is source-current", async (t) => {
  const root = await temporary(t, "product-target");
  const target = join(root, "natural-language-pilot-product-next");
  const built = coreCli("build", "--source", pilotSource, "--target", "natural-language-pilot-product-next", "--out", target);
  assert.equal(built.status, 0, built.stderr || built.stdout);
  const checked = coreCli("check", "--source", pilotSource, "--target", "natural-language-pilot-product-next", "--out", target);
  assert.equal(checked.status, 0, checked.stderr || checked.stdout);
  assert.equal(checked.json.artifactIntact, true);
  assert.equal(checked.json.sourceCurrent, true);
  assert.equal(checked.json.packageId, "natural-language-pilot");
  assert.equal(checked.json.packageVersion, "0.0.1");
  assert.equal(checked.json.coreVersion, "1.0.3");
});

test("a Verify-only source change leaves the actual Product target current", async (t) => {
  const root = await temporary(t, "product-verify-currentness");
  const source = join(root, "source");
  await cp(resolve(repositoryRoot, "domains/natural-language-pilot"), source, { recursive: true });
  const manifest = join(source, "skill-package.json");
  const product = join(root, "product");
  const verify = join(root, "verify");
  assert.equal(coreCli("build", "--source", manifest, "--target", "natural-language-pilot-product-next", "--out", product).status, 0);
  assert.equal(coreCli("build", "--source", manifest, "--target", "natural-language-pilot-verify-next", "--out", verify).status, 0);

  await appendFile(join(source, "targets", "verify", "entry.md"), "\nChanged Verify-only source.\n");
  const productCheck = coreCli("check", "--source", manifest, "--target", "natural-language-pilot-product-next", "--out", product);
  const verifyCheck = coreCli("check", "--source", manifest, "--target", "natural-language-pilot-verify-next", "--out", verify);
  assert.equal(productCheck.status, 0, productCheck.stderr || productCheck.stdout);
  assert.equal(productCheck.json.sourceCurrent, true);
  assert.equal(verifyCheck.status, 0, verifyCheck.stderr || verifyCheck.stdout);
  assert.equal(verifyCheck.json.sourceCurrent, false);
});

test("authoring target materializes the skill evolution method and a semantic-free deterministic heading index", async (t) => {
  const root = await temporary(t, "evolution-method-index");
  const left = join(root, "left");
  const right = join(root, "right");
  assert.equal(coreCli("build", "--source", "authoring-package.json", "--target", "skill-rails", "--out", left).status, 0);
  assert.equal(coreCli("build", "--source", "authoring-package.json", "--target", "skill-rails", "--out", right).status, 0);
  const original = await readFile(resolve(repositoryRoot, "docs/guide/ai-skill-evolution-method_ko.md"));
  assert.deepEqual(await readFile(join(left, "references", "skillEvolutionMethod.md")), original);
  const entry = await readFile(join(left, "SKILL.md"), "utf8");
  assert.match(entry, /smallest complete always-read contract/u);
  assert.match(entry, /real task can safely skip it/u);
  assert.match(entry, /never separate meanings that must be judged together/u);
  assert.match(entry, /mechanically decidable safety checks/u);
  assert.match(entry, /actual target input, output, import, or mechanism/u);
  assert.match(entry, /Add a new semantic relation only/u);
  assert.match(entry, /consequential semantic result as a premise for a later judgment/u);
  assert.match(entry, /`\.skill-rails-build\.json` is delivery evidence only/u);
  assert.deepEqual(await readFile(join(left, "references", "skillEvolutionMethod.index.json")), await readFile(join(right, "references", "skillEvolutionMethod.index.json")));
  const index = JSON.parse(await readFile(join(left, "references", "skillEvolutionMethod.index.json"), "utf8"));
  assert.equal(index.source.sha256, sha256(original));
  assert.equal(index.source.byteLength, original.length);
  assert.deepEqual(index.sections.slice(0, 3).map(({ sectionId, level, parent }) => ({ sectionId, level, parent })), [
    { sectionId: "preamble", level: 1, parent: null },
    { sectionId: "0", level: 2, parent: "preamble" },
    { sectionId: "0.1", level: 3, parent: "0" },
  ]);
  for (const section of index.sections) {
    assert.equal(section.sha256, sha256(original.subarray(section.startByte, section.endByte)));
  }
  const target = JSON.parse(await readFile(join(left, "config", "target.json"), "utf8"));
  assert.equal(target.headingIndex, "references/skillEvolutionMethod.index.json");
  assert.equal(target.embeddedCoreTooling, "authoring-cli-v1");

  const embeddedRoot = join(left, "scripts", "skill-rails-cli");
  const embedded = await fileMap(embeddedRoot);
  assert.deepEqual([...embedded.keys()].sort(), embeddedCoreFiles);
  const receipt = JSON.parse(await readFile(join(left, ".skill-rails-build.json"), "utf8"));
  for (const path of embeddedCoreFiles) {
    const canonical = await readFile(resolve(repositoryRoot, path));
    assert.deepEqual(embedded.get(path), canonical, path);
    assert.equal(receipt.artifacts.find((row) => row.path === `scripts/skill-rails-cli/${path}`)?.sha256, sha256(canonical), path);
    assert.equal(receipt.sources.find((row) => row.id === `embedded-core-tooling:scripts/skill-rails-cli/${path}`)?.sha256, sha256(canonical), path);
  }
});

test("generated authoring CLI operates from a separate source project", async (t) => {
  const root = await temporary(t, "embedded-authoring-cli");
  const authoring = join(root, "installed-skill");
  assert.equal(coreCli("build", "--source", "authoring-package.json", "--target", "skill-rails", "--out", authoring).status, 0);
  const cli = join(authoring, "scripts", "skill-rails-cli", "src", "core", "cli.mjs");
  const helpOutputs = [runNode([cli]), runNode([cli, "help"]), runNode([cli, "--help"])];
  for (const help of helpOutputs) {
    assert.equal(help.status, 0, help.stderr || help.stdout);
    assert.match(help.stdout, /Usage:\s+node <cli\.mjs> <command> \[options\]/u);
    assert.match(help.stdout, /build\s+--source <manifest> --target <target-id> --out <target-dir>/u);
    assert.match(help.stdout, /check\s+--out <target-dir>/u);
    assert.match(help.stdout, /inspect\s+--source <manifest>/u);
    assert.match(help.stdout, /overview --source <manifest>/u);
    assert.match(help.stdout, /task-specific nextAction/u);
  }
  assert.equal(new Set(helpOutputs.map((help) => help.stdout)).size, 1);
  const project = join(root, "ordinary-project");
  await mkdir(join(project, "targets", "tiny"), { recursive: true });
  await writeFile(join(project, "skill-package.json"), JSON.stringify({ schemaVersion: 1, packageId: "tiny-portable-proof", packageVersion: "0.0.1", modules: {}, targets: { tiny: "targets/tiny/target.json" } }));
  await writeFile(join(project, "targets", "tiny", "target.json"), JSON.stringify({ schemaVersion: 1, targetId: "tiny-proof", mode: "prose", entry: "entry.md", imports: [] }));
  await writeFile(join(project, "targets", "tiny", "entry.md"), "---\nname: tiny-proof\ndescription: Exercise one separate-project build.\n---\n\n# Tiny proof\n");

  const inspected = runNode([cli, "inspect", "--source", "skill-package.json", "--id", "tiny-proof", "--json"], { cwd: project });
  assert.equal(inspected.status, 0, inspected.stderr || inspected.stdout);
  assert.equal(inspected.json.focus.id, "tiny-proof");
  const overview = runNode([cli, "overview", "--source", "skill-package.json"], { cwd: project });
  assert.equal(overview.status, 0, overview.stderr || overview.stdout);
  assert.match(overview.stdout, /# Source graph overview/u);
  const left = runNode([cli, "build", "--source", "skill-package.json", "--target", "tiny-proof", "--out", join(root, "left")], { cwd: project });
  const right = runNode([cli, "build", "--source", "skill-package.json", "--target", "tiny-proof", "--out", join(root, "right")], { cwd: project });
  assert.equal(left.status, 0, left.stderr || left.stdout);
  assert.equal(right.status, 0, right.stderr || right.stdout);
  assert.equal(left.json.outputs[0].treeSha256, right.json.outputs[0].treeSha256);
  const checked = runNode([cli, "check", "--source", "skill-package.json", "--target", "tiny-proof", "--out", join(root, "left")], { cwd: project });
  assert.equal(checked.status, 0, checked.stderr || checked.stdout);
  assert.equal(checked.json.artifactIntact, true);
  assert.equal(checked.json.sourceCurrent, true);
});

test("copied target checks integrity without repository or sibling skill access", async (t) => {
  const root = await temporary(t, "standalone");
  const built = coreCli("build", "--source", pilotSource, "--out-root", join(root, "dist"));
  assert.equal(built.status, 0, built.stdout);
  const sourceTarget = join(root, "dist", "skills", "natural-language-pilot-verify-next");
  const installed = join(root, "install", "natural-language-pilot-verify-next");
  await cp(sourceTarget, installed, { recursive: true });
  const checked = runNode([join(installed, "scripts", "run.mjs"), "check"], { cwd: root });
  assert.equal(checked.status, 0, checked.stdout);
  assert.equal(checked.json.status, "ARTIFACT_INTACT");
  assert.equal(checked.json.packageId, "natural-language-pilot");
  assert.equal(checked.json.packageVersion, "0.0.1");
  assert.equal(checked.json.coreVersion, "1.0.3");
  assert.equal(checked.json.sourceCurrent, null);
  assert.equal(checked.json.remoteLatest, null);
});

test("record-only target materializes only its public runtime commands", async (t) => {
  const root = await temporary(t, "record-only-runtime");
  const built = coreCli("build", "--source", pilotSource, "--out-root", root);
  assert.equal(built.status, 0, built.stdout);
  const target = join(root, "skills", "natural-language-pilot-verify-next");
  const files = await fileMap(target);
  assert.equal(files.has("scripts/runtime/initialize-record.mjs"), true);
  assert.equal(files.has("scripts/runtime/record.mjs"), true);
  assert.equal(files.has("scripts/runtime/prepare.mjs"), false);
  assert.equal(files.has("scripts/domain/observer.mjs"), false);
  assert.equal(files.has("config/packet.json"), false);
  assert.equal(files.has("references/fallback.md"), false);
  const result = runNode([join(target, "scripts", "run.mjs"), "prepare", "--project", root]);
  assert.notEqual(result.status, 0);
  assert.equal(result.json.code, "ARGUMENT_INVALID");
  assert.match(result.json.nextAction, /check, initialize, or record/u);
  await rm(join(target, "scripts", "runtime", "initialize-record.mjs"));
  const missingRuntime = runNode([join(target, "scripts", "run.mjs"), "check"]);
  assert.notEqual(missingRuntime.status, 0);
  assert.equal(missingRuntime.json.code, "ARTIFACT_INTEGRITY_FAILED");
});

test("authoring check and installed check distinguish a hand-edited artifact", async (t) => {
  const root = await temporary(t, "modified");
  const built = coreCli("build", "--source", pilotSource, "--out-root", root);
  assert.equal(built.status, 0, built.stdout);
  const target = join(root, "skills", "natural-language-pilot-verify-next");
  await appendFile(join(target, "SKILL.md"), "edited\n");
  const authoring = coreCli("check", "--out", target);
  assert.notEqual(authoring.status, 0);
  assert.equal(authoring.json.code, "GENERATED_ARTIFACT_MODIFIED");
  const installed = runNode([join(target, "scripts", "run.mjs"), "check"]);
  assert.notEqual(installed.status, 0);
  assert.equal(installed.json.code, "ARTIFACT_INTEGRITY_FAILED");
});

test("record-only target does not materialize the preserved M4 fallback", async (t) => {
  const root = await temporary(t, "fallback");
  const built = coreCli("build", "--source", pilotSource, "--out-root", root);
  assert.equal(built.status, 0, built.stdout);
  const target = join(root, "skills", "natural-language-pilot-verify-next");
  const receipt = JSON.parse(await readFile(join(target, ".skill-rails-build.json"), "utf8"));
  const sourceRow = receipt.sources.find((item) => item.id === "module:verifyBaseline");
  const artifactRow = receipt.artifacts.find((item) => item.path === "references/fallback.md");
  assert.equal(sourceRow, undefined);
  assert.equal(artifactRow, undefined);
  assert.doesNotMatch(await readFile(join(target, "SKILL.md"), "utf8"), /Verify control baseline/u);
});

test("source freshness is separate from intact installed bytes", async (t) => {
  const root = await temporary(t, "freshness");
  const source = join(root, "source");
  await cp(resolve(repositoryRoot, "domains/natural-language-pilot"), source, { recursive: true });
  const manifest = join(source, "skill-package.json");
  const target = join(root, "target");
  assert.equal(coreCli("build", "--source", manifest, "--target", "natural-language-pilot-verify-next", "--out", target).status, 0);
  await appendFile(join(source, "targets", "verify", "entry.md"), "\nChanged canonical source.\n");
  const checked = coreCli("check", "--source", manifest, "--target", "natural-language-pilot-verify-next", "--out", target);
  assert.equal(checked.status, 0, checked.stdout);
  assert.equal(checked.json.artifactIntact, true);
  assert.equal(checked.json.sourceCurrent, false);
  assert.equal(checked.json.remoteLatest, null);
});

test("schema, import, duplicate key, case collision and path escape fail closed", async (t) => {
  const sandbox = await temporary(t, "negative");
  const root = join(sandbox, "package");
  await mkdir(join(root, "modules"), { recursive: true });
  await mkdir(join(root, "targets", "one"), { recursive: true });
  await writeFile(join(root, "modules", "a.md"), "A\n");
  await writeFile(join(root, "targets", "one", "entry.md"), "---\nname: one\ndescription: one target\n---\nBody\n");
  await writeFile(join(root, "targets", "one", "target.json"), JSON.stringify({ schemaVersion: 1, targetId: "one", mode: "prose", entry: "entry.md", imports: ["missing"] }));
  const manifest = join(root, "skill-package.json");
  await writeFile(manifest, '{"schemaVersion":1,"packageId":"p","packageVersion":"1","modules":{"A":"modules/a.md","a":"modules/a.md"},"targets":{"one":"targets/one/target.json"}}');
  assert.equal(coreCli("inspect", "--source", manifest, "--id", "p", "--json").json.code, "CASE_COLLISION");
  await writeFile(manifest, '{"schemaVersion":1,"packageId":"p","packageVersion":"1","modules":{"a":"modules/a.md","a":"modules/a.md"},"targets":{"one":"targets/one/target.json"}}');
  assert.equal(coreCli("inspect", "--source", manifest, "--id", "p", "--json").json.code, "JSON_KEY_COLLISION");
  await writeFile(manifest, JSON.stringify({ schemaVersion: 2, packageId: "p", packageVersion: "1", modules: {}, targets: { one: "targets/one/target.json" } }));
  assert.equal(coreCli("inspect", "--source", manifest, "--id", "p", "--json").json.code, "UNSUPPORTED_VERSION");
  await writeFile(manifest, JSON.stringify({ schemaVersion: 1, packageId: "p", packageVersion: "1", modules: { a: "modules/a.md" }, targets: { one: "targets/one/target.json" } }));
  assert.equal(coreCli("inspect", "--source", manifest, "--id", "p", "--json").json.code, "IMPORT_MISSING");
  await writeFile(join(root, "targets", "one", "target.json"), JSON.stringify({ schemaVersion: 1, targetId: "one", mode: "prose", entry: "entry.md", imports: [], headingIndex: "a" }));
  assert.equal(coreCli("inspect", "--source", manifest, "--id", "p", "--json").json.code, "HEADING_INDEX_UNDECLARED");
  await writeFile(join(root, "targets", "one", "target.json"), JSON.stringify({ schemaVersion: 1, targetId: "one", mode: "prose", entry: "entry.md", imports: [], embeddedCoreTooling: "other-cli" }));
  assert.equal(coreCli("inspect", "--source", manifest, "--id", "p", "--json").json.code, "SCHEMA_INVALID");
  await writeFile(join(root, "targets", "one", "target.json"), JSON.stringify({ schemaVersion: 1, targetId: "one", mode: "prose", entry: "../../../outside.md", imports: [] }));
  await writeFile(join(sandbox, "outside.md"), "outside\n");
  assert.equal(coreCli("inspect", "--source", manifest, "--id", "p", "--json").json.code, "PATH_OUTSIDE_ROOT");
});

test("record-only mode rejects prepare-only and embedded-authoring fields", async (t) => {
  const root = await temporary(t, "record-only-shape");
  await cp(resolve(repositoryRoot, "domains", "natural-language-pilot"), root, { recursive: true });
  const targetPath = join(root, "targets", "verify", "target.json");
  const target = JSON.parse(await readFile(targetPath, "utf8"));
  target.fallbackModule = "verifyBaseline";
  await writeFile(targetPath, JSON.stringify(target));
  const result = coreCli("build", "--source", join(root, "skill-package.json"), "--out-root", join(root, "dist"));
  assert.notEqual(result.status, 0);
  assert.equal(result.json.code, "SCHEMA_INVALID");
  delete target.fallbackModule;
  target.embeddedCoreTooling = "authoring-cli-v1";
  await writeFile(targetPath, JSON.stringify(target));
  const embeddedResult = coreCli("build", "--source", join(root, "skill-package.json"), "--out-root", join(root, "embedded-dist"));
  assert.notEqual(embeddedResult.status, 0);
  assert.equal(embeddedResult.json.code, "SCHEMA_INVALID");
});

test("a symlink or junction escape is rejected when the host permits it", async (t) => {
  const root = await temporary(t, "symlink");
  const outside = await temporary(t, "outside");
  await writeFile(join(outside, "entry.md"), "---\nname: one\ndescription: one target\n---\nBody\n");
  await mkdir(join(root, "targets", "one"), { recursive: true });
  try { await symlink(outside, join(root, "targets", "one", "linked"), "junction"); }
  catch (error) { if (["EPERM", "ENOTSUP"].includes(error?.code)) return t.skip(`host cannot create junction: ${error.code}`); throw error; }
  await writeFile(join(root, "targets", "one", "target.json"), JSON.stringify({ schemaVersion: 1, targetId: "one", mode: "prose", entry: "linked/entry.md", imports: [] }));
  await writeFile(join(root, "skill-package.json"), JSON.stringify({ schemaVersion: 1, packageId: "p", packageVersion: "1", modules: {}, targets: { one: "targets/one/target.json" } }));
  const result = coreCli("inspect", "--source", join(root, "skill-package.json"), "--id", "one", "--json");
  assert.notEqual(result.status, 0);
  assert.equal(result.json.code, "PATH_OUTSIDE_ROOT");
});
