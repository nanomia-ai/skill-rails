import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { coreCli, repositoryRoot, temporary } from "./helpers.mjs";

test("repository exposes exactly one active generated skill and no active legacy import", async () => {
  const files = [
    "src/core/build.mjs", "src/core/check.mjs", "src/core/cli.mjs", "src/core/inspect.mjs", "src/core/validate.mjs",
    "src/runtime/common.mjs", "src/runtime/integrity.mjs", "src/runtime/run.mjs",
    "authoring-package.json", "authoring/skill-rails/SKILL.source.md",
    "domains/natural-language-pilot/skill-package.json",
  ];
  for (const file of files) assert.doesNotMatch(await readFile(resolve(repositoryRoot, file), "utf8"), /(?:from|import|spawn|fallback)[^\n]*legacy[\\/]/iu, file);
  const discovered = spawnSync("rg", ["--files", "skills", "-g", "SKILL.md"], { cwd: repositoryRoot, encoding: "utf8" });
  assert.equal(discovered.status, 0, discovered.stderr);
  assert.deepEqual(discovered.stdout.trim().replaceAll("\\", "/").split(/\r?\n/u), ["skills/skill-rails/SKILL.md"]);
  assert.match(await readFile(resolve(repositoryRoot, "skills/skill-rails/SKILL.md"), "utf8"), /^name: skill-rails$/m);
});

test("authoring generated target is source-current and npm payload excludes implementation roots", async (t) => {
  const checked = coreCli("check", "--source", "authoring-package.json", "--target", "skill-rails", "--out", "skills/skill-rails");
  assert.equal(checked.status, 0, checked.stdout);
  assert.equal(checked.json.sourceCurrent, true);
  const cache = await temporary(t, "npm-cache");
  const packed = spawnSync(process.platform === "win32" ? "npm.exe" : "npm", ["pack", "--dry-run", "--json", "--cache", cache], { cwd: repositoryRoot, encoding: "utf8" });
  assert.equal(packed.status, 0, packed.stderr);
  const result = JSON.parse(packed.stdout);
  const paths = result[0].files.map((item) => item.path.replaceAll("\\", "/"));
  assert.ok(paths.includes("skills/skill-rails/SKILL.md"));
  for (const forbidden of ["legacy/", "domains/", "fixtures/", "tests/", "src/", "authoring/"]) assert.equal(paths.some((path) => path.startsWith(forbidden)), false, forbidden);
});
