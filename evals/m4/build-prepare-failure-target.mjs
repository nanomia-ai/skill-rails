#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const packageArgument = process.argv[2];
if (!packageArgument) throw new Error("Usage: build-prepare-failure-target.mjs <new-package-root>");
const packageRoot = resolve(packageArgument);
try {
  await stat(packageRoot);
  throw new Error(`OUTPUT_EXISTS:${packageRoot}`);
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const sourceRoot = resolve(packageRoot, "_evaluation-source");
await mkdir(packageRoot, { recursive: true });
await cp(resolve(repositoryRoot, "domains/natural-language-pilot"), sourceRoot, { recursive: true, force: false, errorOnExist: true });
await cp(resolve(repositoryRoot, "fixtures/verify-v1/prepare-record-target.json"), resolve(sourceRoot, "targets/verify/target.json"), { force: true });
await cp(resolve(repositoryRoot, "fixtures/verify-v1/prepare-record-entry.md"), resolve(sourceRoot, "targets/verify/entry.md"), { force: true });
const originalObserver = await readFile(resolve(sourceRoot, "targets/verify/observer.mjs"));
const faultObserverPath = resolve(repositoryRoot, "fixtures/verify-v1/faults/observer-prepare-failure.mjs");
const faultObserver = await readFile(faultObserverPath);
await cp(faultObserverPath, resolve(sourceRoot, "targets/verify/observer.mjs"), { force: true });

const build = spawnSync(process.execPath, [
  resolve(repositoryRoot, "src/core/cli.mjs"), "build",
  "--source", resolve(sourceRoot, "skill-package.json"),
  "--out-root", packageRoot,
], { cwd: repositoryRoot, encoding: "utf8", windowsHide: true });
if (build.status !== 0) throw new Error(`FAULT_TARGET_BUILD_FAILED:${build.stderr || build.stdout}`);
const built = JSON.parse(build.stdout.trim());
const target = resolve(packageRoot, "skills/natural-language-pilot-verify-next");
const receipt = JSON.parse(await readFile(resolve(target, ".skill-rails-build.json"), "utf8"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
process.stdout.write(`${JSON.stringify({
  schemaVersion: 1,
  status: "BUILT_PREPARE_FAILURE_VARIANT",
  packageRoot,
  target,
  treeSha256: built.outputs[0].treeSha256,
  originalObserverSha256: hash(originalObserver),
  faultObserverSha256: hash(faultObserver),
  fallbackSourceSha256: receipt.sources.find((item) => item.id === "module:verifyBaseline")?.sha256 ?? null,
})}\n`);
