import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { sha256 } from "../src/core/canonicalize.mjs";
import { coreCli, fileMap, repositoryRoot, runNode, temporary } from "./helpers.mjs";

const binaryTemplate = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0xff, 0x0d, 0x0a, 0x00]);

async function toolPackage(t, targets) {
  const root = await temporary(t, "tools");
  await mkdir(join(root, "tools", "fill-form", "templates"), { recursive: true });
  await writeFile(join(root, "tools", "check-state.mjs"), "#!/usr/bin/env node\r\nprocess.stdout.write(JSON.stringify({ status: \"PASS\" }));\r\n");
  await writeFile(join(root, "tools", "fill-form", "main.py"), "print('filled')\n");
  await writeFile(join(root, "tools", "fill-form", "templates", "form.xlsx"), binaryTemplate);
  const manifest = { schemaVersion: 2, packageId: "p", packageVersion: "1", modules: {}, tools: { "check-state": "tools/check-state.mjs", "fill-form": "tools/fill-form" }, targets: {} };
  for (const [id, tools] of Object.entries(targets)) {
    await mkdir(join(root, "targets", id), { recursive: true });
    await writeFile(join(root, "targets", id, "entry.md"), `---\nname: ${id}\ndescription: ${id} target\n---\nRun \`node <skill-root>/scripts/check-state.mjs\` after each write.\n`);
    await writeFile(join(root, "targets", id, "target.json"), JSON.stringify({ schemaVersion: 2, targetId: id, entry: "entry.md", imports: [], tools }));
    manifest.targets[id] = `targets/${id}/target.json`;
  }
  await writeFile(join(root, "skill-package.json"), JSON.stringify(manifest));
  return { root, manifest: join(root, "skill-package.json") };
}

test("a tool is delivered byte for byte, shared across targets, and only where declared", async (t) => {
  const { root, manifest } = await toolPackage(t, { work: ["check-state", "fill-form"], verify: ["check-state"], plain: [] });
  const built = coreCli("build", "--source", manifest, "--out-root", join(root, "dist"));
  assert.equal(built.status, 0, built.stdout);
  const work = await fileMap(join(root, "dist", "skills", "work"));
  assert.deepEqual([...work.keys()].sort(), [".skill-rails-build.json", "SKILL.md", "scripts/check-state.mjs", "scripts/fill-form/main.py", "scripts/fill-form/templates/form.xlsx"]);
  assert.deepEqual(work.get("scripts/check-state.mjs"), await readFile(join(root, "tools", "check-state.mjs")));
  assert.deepEqual(work.get("scripts/fill-form/templates/form.xlsx"), binaryTemplate);
  const verify = await fileMap(join(root, "dist", "skills", "verify"));
  assert.deepEqual([...verify.keys()].sort(), [".skill-rails-build.json", "SKILL.md", "scripts/check-state.mjs"]);
  assert.deepEqual([...(await fileMap(join(root, "dist", "skills", "plain"))).keys()].sort(), [".skill-rails-build.json", "SKILL.md"]);
  const ran = runNode([join(root, "dist", "skills", "verify", "scripts", "check-state.mjs")]);
  assert.equal(ran.status, 0, ran.stderr);
  assert.equal(ran.json.status, "PASS");

  const receipt = JSON.parse(await readFile(join(root, "dist", "skills", "work", ".skill-rails-build.json"), "utf8"));
  assert.equal(receipt.sources.find((row) => row.path === "tools/fill-form/templates/form.xlsx")?.sha256, sha256(binaryTemplate));
  assert.equal(receipt.sources.some((row) => row.id.startsWith("record-runtime:")), false);
  const checked = coreCli("check", "--source", manifest, "--target", "work", "--out", join(root, "dist", "skills", "work"));
  assert.equal(checked.json.artifactIntact, true);
  assert.equal(checked.json.sourceCurrent, true);

  await writeFile(join(root, "tools", "check-state.mjs"), "process.stdout.write('changed');\n");
  for (const target of ["work", "verify"]) {
    const stale = coreCli("check", "--source", manifest, "--target", target, "--out", join(root, "dist", "skills", target));
    assert.equal(stale.json.sourceCurrent, false, target);
  }
  assert.equal(coreCli("check", "--source", manifest, "--target", "plain", "--out", join(root, "dist", "skills", "plain")).json.sourceCurrent, true);
});

test("inspect and overview show a tool's owner, consumers, and delivered paths", async (t) => {
  const { manifest } = await toolPackage(t, { work: ["check-state", "fill-form"], verify: ["check-state"] });
  const byId = coreCli("inspect", "--source", manifest, "--id", "check-state", "--json");
  assert.equal(byId.status, 0, byId.stdout);
  assert.deepEqual(byId.json.focus, { kind: "tool", id: "check-state", path: "tools/check-state.mjs" });
  assert.deepEqual(byId.json.consumers, ["verify", "work"]);
  const byPath = coreCli("inspect", "--source", manifest, "--path", "tools/fill-form/templates/form.xlsx", "--json");
  assert.equal(byPath.json.focus.id, "fill-form");
  assert.ok(byPath.json.artifacts.some((row) => row.targetId === "work" && row.path === "scripts/fill-form/templates/form.xlsx"));
  const target = coreCli("inspect", "--source", manifest, "--id", "work", "--json");
  assert.deepEqual(target.json.tools, ["check-state", "fill-form"]);
  const overview = coreCli("overview", "--source", manifest);
  assert.match(overview.stdout, /`check-state` — `tools\/check-state\.mjs`; consumers: `verify`, `work`/u);
});

test("an undeclared, escaping, or colliding tool fails closed", async (t) => {
  const { root, manifest } = await toolPackage(t, { work: ["missing"] });
  assert.equal(coreCli("inspect", "--source", manifest, "--id", "p", "--json").json.code, "TOOL_MISSING");

  const descriptor = JSON.parse(await readFile(manifest, "utf8"));
  await writeFile(manifest, JSON.stringify({ ...descriptor, tools: { outside: "../outside.mjs" } }));
  assert.equal(coreCli("inspect", "--source", manifest, "--id", "p", "--json").json.code, "PATH_OUTSIDE_ROOT");

  await writeFile(manifest, JSON.stringify({ ...descriptor, tools: { run: "tools/check-state.mjs" } }));
  await writeFile(join(root, "targets", "work", "target.json"), JSON.stringify({ schemaVersion: 2, targetId: "work", entry: "entry.md", imports: [], tools: ["run"] }));
  assert.equal(coreCli("build", "--source", manifest, "--out-root", join(root, "plain-run")).status, 0);
  const recordSource = join(root, "record");
  await cp(resolve(repositoryRoot, "tests", "fixtures", "natural-language-pilot"), recordSource, { recursive: true });
  await cp(join(root, "tools"), join(recordSource, "tools"), { recursive: true });
  const pilotManifest = JSON.parse(await readFile(join(recordSource, "skill-package.json"), "utf8"));
  await writeFile(join(recordSource, "skill-package.json"), JSON.stringify({ ...pilotManifest, tools: { run: "tools/check-state.mjs" } }));
  const verifyPath = join(recordSource, "targets", "verify", "target.json");
  await writeFile(verifyPath, JSON.stringify({ ...JSON.parse(await readFile(verifyPath, "utf8")), tools: ["run"] }));
  const collision = coreCli("build", "--source", join(recordSource, "skill-package.json"), "--target", "natural-language-pilot-verify-next", "--out", join(root, "collision"));
  assert.equal(collision.json.code, "ARTIFACT_COLLISION");

  await writeFile(join(recordSource, "tools", "runner"), "no extension\n");
  await writeFile(join(recordSource, "skill-package.json"), JSON.stringify({ ...pilotManifest, tools: { runtime: "tools/runner" } }));
  await writeFile(verifyPath, JSON.stringify({ ...JSON.parse(await readFile(verifyPath, "utf8")), tools: ["runtime"] }));
  const folderCollision = coreCli("build", "--source", join(recordSource, "skill-package.json"), "--target", "natural-language-pilot-verify-next", "--out", join(root, "folder-collision"));
  assert.equal(folderCollision.json.code, "ARTIFACT_COLLISION");

  await mkdir(join(recordSource, "tools", "runtime-folder", "Common.MJS"), { recursive: true });
  await writeFile(join(recordSource, "tools", "runtime-folder", "Common.MJS", "child.txt"), "case-folded folder\n");
  await writeFile(join(recordSource, "skill-package.json"), JSON.stringify({ ...pilotManifest, tools: { runtime: "tools/runtime-folder" } }));
  const caseCollision = coreCli("build", "--source", join(recordSource, "skill-package.json"), "--target", "natural-language-pilot-verify-next", "--out", join(root, "case-collision"));
  assert.equal(caseCollision.json.code, "ARTIFACT_COLLISION");
});

test("an empty folder anywhere inside a tool fails closed instead of vanishing", async (t) => {
  const { root, manifest } = await toolPackage(t, { work: ["fill-form"] });
  await mkdir(join(root, "tools", "fill-form", "templates", "empty"));
  const result = coreCli("inspect", "--source", manifest, "--id", "p", "--json");
  assert.equal(result.json.code, "SOURCE_PATH_INVALID");
  assert.match(result.json.message, /tools\/fill-form\/templates\/empty/u);
});

test("an ID shared by a tool and a target is an ambiguous inspect query", async (t) => {
  const { manifest } = await toolPackage(t, { "check-state": ["check-state"] });
  const ambiguous = coreCli("inspect", "--source", manifest, "--id", "check-state", "--json");
  assert.equal(ambiguous.json.code, "INSPECT_AMBIGUOUS");
  assert.equal(coreCli("inspect", "--source", manifest, "--path", "tools/check-state.mjs", "--json").json.focus.kind, "tool");
});

test("a tool declared through a junction or link fails closed when the host permits it", async (t) => {
  const { root, manifest } = await toolPackage(t, { work: ["fill-form"] });
  try { await symlink(join(root, "tools", "fill-form"), join(root, "tools", "linked"), "junction"); }
  catch (error) { if (["EPERM", "ENOTSUP"].includes(error?.code)) return t.skip(`host cannot create junction: ${error.code}`); throw error; }
  const descriptor = JSON.parse(await readFile(manifest, "utf8"));
  await writeFile(manifest, JSON.stringify({ ...descriptor, tools: { "fill-form": "tools/linked" } }));
  assert.equal(coreCli("inspect", "--source", manifest, "--id", "p", "--json").json.code, "SOURCE_PATH_INVALID");
});

test("a linked file inside a tool folder fails closed when the host permits links", async (t) => {
  const { root, manifest } = await toolPackage(t, { work: ["fill-form"] });
  try { await symlink(join(root, "tools", "check-state.mjs"), join(root, "tools", "fill-form", "linked.mjs")); }
  catch (error) { if (["EPERM", "ENOTSUP"].includes(error?.code)) return t.skip(`host cannot create symlink: ${error.code}`); throw error; }
  assert.equal(coreCli("inspect", "--source", manifest, "--id", "p", "--json").json.code, "SOURCE_PATH_INVALID");
});

test("a target's files land at their declared paths byte for byte and stay out of the paths the build owns", async (t) => {
  const { root, manifest } = await toolPackage(t, { work: ["check-state"], verify: [] });
  const icon = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  await mkdir(join(root, "targets", "work", "agents"), { recursive: true });
  await mkdir(join(root, "brand"), { recursive: true });
  await writeFile(join(root, "targets", "work", "agents", "openai.yaml"), "policy:\r\n  allow_implicit_invocation: false\r\n");
  await writeFile(join(root, "brand", "icon.png"), icon);
  const descriptorPath = join(root, "targets", "work", "target.json");
  const descriptor = JSON.parse(await readFile(descriptorPath, "utf8"));
  await writeFile(descriptorPath, JSON.stringify({ ...descriptor, files: { "agents/openai.yaml": "agents/openai.yaml", assets: "../../brand" } }));
  await writeFile(join(root, "targets", "verify", "target.json"), JSON.stringify({ schemaVersion: 2, targetId: "verify", entry: "entry.md", imports: [], tools: [], files: { assets: "../../brand" } }));
  const out = join(root, "dist", "skills", "work");
  assert.equal(coreCli("build", "--source", manifest, "--out-root", join(root, "dist")).status, 0);
  const work = await fileMap(out);
  assert.deepEqual([...work.keys()].sort(), [".skill-rails-build.json", "SKILL.md", "agents/openai.yaml", "assets/icon.png", "scripts/check-state.mjs"]);
  assert.deepEqual(work.get("agents/openai.yaml"), await readFile(join(root, "targets", "work", "agents", "openai.yaml")));
  assert.deepEqual(work.get("assets/icon.png"), icon);
  const shared = coreCli("inspect", "--source", manifest, "--path", "brand/icon.png", "--json");
  assert.deepEqual(shared.json.focus, { kind: "file", id: null, path: "brand/icon.png" });
  assert.deepEqual(shared.json.consumers, ["verify", "work"]);
  assert.deepEqual(coreCli("inspect", "--source", manifest, "--path", "brand", "--json").json.consumers, ["verify", "work"]);
  assert.equal(coreCli("check", "--source", manifest, "--target", "work", "--out", out).json.sourceCurrent, true);
  await writeFile(join(root, "brand", "icon.png"), Buffer.from([0x00]));
  assert.equal(coreCli("check", "--source", manifest, "--target", "work", "--out", out).json.sourceCurrent, false);

  for (const reserved of ["SKILL.md", "references/extra.md", "Scripts/x.mjs", ".skill-rails-build.json"]) {
    await writeFile(descriptorPath, JSON.stringify({ ...descriptor, files: { [reserved]: "agents/openai.yaml" } }));
    assert.equal(coreCli("inspect", "--source", manifest, "--id", "p", "--json").json.code, "FILE_PATH_RESERVED", reserved);
  }
  const outside = await temporary(t, "outside");
  await writeFile(join(outside, "LICENSE.txt"), "outside\n");
  await writeFile(descriptorPath, JSON.stringify({ ...descriptor, files: { "LICENSE.txt": relative(join(root, "targets", "work"), join(outside, "LICENSE.txt")).replaceAll("\\", "/") } }));
  assert.equal(coreCli("inspect", "--source", manifest, "--id", "p", "--json").json.code, "PATH_OUTSIDE_ROOT");
});
