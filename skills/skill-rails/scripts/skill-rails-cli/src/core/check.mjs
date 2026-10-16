import { lstat, readFile, readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { canonicalJson, compareCodePoint, sha256, treeSha256 } from "./canonicalize.mjs";
import { fail } from "./errors.mjs";

// The same output path cannot be rebuilt while it fails integrity, so recovery goes through a fresh output.
const REBUILD_FRESH = "Keep this copy; carry any change the user wants from it into canonical source, build into a fresh output directory and check it, then replace this copy; do not merge generated edits.";

async function walk(root, current = root) {
  const files = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const physical = resolve(current, entry.name);
    if (entry.isSymbolicLink()) fail("ARTIFACT_INTEGRITY_FAILED", "Generated target contains a symbolic link.", REBUILD_FRESH);
    if (entry.isDirectory()) files.push(...await walk(root, physical));
    else if (entry.isFile()) files.push(relative(root, physical).replaceAll("\\", "/"));
    else fail("ARTIFACT_INTEGRITY_FAILED", "Generated target contains a non-regular artifact.", REBUILD_FRESH);
  }
  return files.sort(compareCodePoint);
}

export async function readReceipt(targetRoot) {
  let receipt;
  try { receipt = JSON.parse(await readFile(resolve(targetRoot, ".skill-rails-build.json"), "utf8")); }
  catch { fail("ARTIFACT_INTEGRITY_FAILED", "The generated build receipt is missing or invalid.", "If this folder is a build output, build into a fresh output directory and check it before replacing this one; otherwise choose another output path."); }
  if (receipt?.schemaVersion !== 1) fail("UNSUPPORTED_VERSION", "The generated receipt version is unsupported.", "Rebuild with a compatible core.");
  if (!Array.isArray(receipt.artifacts) || typeof receipt.treeSha256 !== "string") fail("ARTIFACT_INTEGRITY_FAILED", "The generated build receipt shape is invalid.", REBUILD_FRESH);
  return receipt;
}

export async function assertArtifactIntegrity(targetRoot, mismatchCode = "ARTIFACT_INTEGRITY_FAILED") {
  const root = resolve(targetRoot);
  const receipt = await readReceipt(root);
  const expectedPaths = receipt.artifacts.map((item) => item.path).sort(compareCodePoint);
  const actualPaths = (await walk(root)).filter((path) => path !== ".skill-rails-build.json");
  if (canonicalJson(actualPaths) !== canonicalJson(expectedPaths)) {
    fail(mismatchCode, "Generated artifact paths differ from the receipt.", REBUILD_FRESH, { expectedPaths, actualPaths });
  }
  const artifacts = new Map();
  for (const expected of receipt.artifacts) {
    const physical = resolve(root, ...expected.path.split("/"));
    const stats = await lstat(physical);
    if (!stats.isFile()) fail("ARTIFACT_INTEGRITY_FAILED", `${expected.path} is not a regular file.`, REBUILD_FRESH);
    const bytes = await readFile(physical);
    const actual = sha256(bytes);
    if (actual !== expected.sha256) fail(mismatchCode, `${expected.path} differs from the receipt.`, REBUILD_FRESH, { path: expected.path, expected: expected.sha256, actual });
    artifacts.set(expected.path, bytes);
  }
  const actualTree = treeSha256(artifacts);
  if (actualTree !== receipt.treeSha256) fail(mismatchCode, "Generated tree hash differs from the receipt.", REBUILD_FRESH);
  return receipt;
}

export async function checkTarget(targetRoot, expectedPlan = undefined) {
  const receipt = await assertArtifactIntegrity(targetRoot, "GENERATED_ARTIFACT_MODIFIED");
  const sourceCurrent = expectedPlan === undefined ? null : canonicalJson(receipt.artifacts) === canonicalJson(expectedPlan.receipt.artifacts)
    && receipt.treeSha256 === expectedPlan.receipt.treeSha256
    && canonicalJson(receipt.sources) === canonicalJson(expectedPlan.receipt.sources);
  return {
    schemaVersion: 1,
    status: "CHECKED",
    packageId: receipt.packageId,
    packageVersion: receipt.packageVersion,
    coreVersion: receipt.coreVersion,
    targetId: receipt.targetId,
    artifactIntact: true,
    sourceCurrent,
    remoteLatest: null,
    treeSha256: receipt.treeSha256,
  };
}
