import test from "node:test";
import assert from "node:assert/strict";
import { appendFile, cp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canonicalText, sha256 } from "../src/core/canonicalize.mjs";
import { coreCli, fileMap, repositoryRoot, runNode, temporary } from "./helpers.mjs";

const pilotSource = "domains/natural-language-pilot/skill-package.json";

test("same source builds byte-identical standalone target trees", async (t) => {
  const root = await temporary(t, "double-build");
  const left = coreCli("build", "--source", pilotSource, "--out-root", join(root, "left"));
  const right = coreCli("build", "--source", pilotSource, "--out-root", join(root, "right"));
  assert.equal(left.status, 0, left.stderr || left.stdout);
  assert.equal(right.status, 0, right.stderr || right.stdout);
  assert.equal(left.json.outputs[0].treeSha256, right.json.outputs[0].treeSha256);
  const leftFiles = await fileMap(join(root, "left", "skills", "natural-language-pilot-verify-next"));
  const rightFiles = await fileMap(join(root, "right", "skills", "natural-language-pilot-verify-next"));
  assert.deepEqual([...leftFiles.keys()], [...rightFiles.keys()]);
  for (const [path, bytes] of leftFiles) assert.deepEqual(bytes, rightFiles.get(path), path);
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
  assert.equal(checked.json.sourceCurrent, null);
  assert.equal(checked.json.remoteLatest, null);
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

test("fallback and control baseline have one canonical source hash", async (t) => {
  const root = await temporary(t, "fallback");
  const built = coreCli("build", "--source", pilotSource, "--out-root", root);
  assert.equal(built.status, 0, built.stdout);
  const target = join(root, "skills", "natural-language-pilot-verify-next");
  const receipt = JSON.parse(await readFile(join(target, ".skill-rails-build.json"), "utf8"));
  const sourceBytes = Buffer.from(canonicalText(await readFile(resolve(repositoryRoot, "domains/natural-language-pilot/modules/verify-baseline.md")), "verify-baseline.md"), "utf8");
  const sourceRow = receipt.sources.find((item) => item.id === "module:verifyBaseline");
  const artifactRow = receipt.artifacts.find((item) => item.path === "references/fallback.md");
  assert.equal(sourceRow.sha256, sha256(sourceBytes));
  assert.equal(artifactRow.sha256, sourceRow.sha256);
  assert.deepEqual(await readFile(join(target, "references", "fallback.md")), sourceBytes);
  assert.doesNotMatch(await readFile(join(target, "SKILL.md"), "utf8"), /Verify control baseline/u);
});

test("source freshness is separate from intact installed bytes", async (t) => {
  const root = await temporary(t, "freshness");
  const source = join(root, "source");
  await cp(resolve(repositoryRoot, "domains/natural-language-pilot"), source, { recursive: true });
  const manifest = join(source, "skill-package.json");
  const target = join(root, "target");
  assert.equal(coreCli("build", "--source", manifest, "--target", "natural-language-pilot-verify-next", "--out", target).status, 0);
  await appendFile(join(source, "modules", "purpose.md"), "\nChanged canonical source.\n");
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
  await writeFile(join(root, "targets", "one", "target.json"), JSON.stringify({ schemaVersion: 1, targetId: "one", mode: "prose", entry: "../../../outside.md", imports: [] }));
  await writeFile(join(sandbox, "outside.md"), "outside\n");
  assert.equal(coreCli("inspect", "--source", manifest, "--id", "p", "--json").json.code, "PATH_OUTSIDE_ROOT");
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
