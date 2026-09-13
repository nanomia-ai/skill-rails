import { readFile, readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { canonicalJson, compareCodePoint, fail, readJson, sha256 } from "./common.mjs";

async function walk(root, current = root) {
  const result = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const path = resolve(current, entry.name);
    if (entry.isSymbolicLink()) fail("ARTIFACT_INTEGRITY_FAILED", "The target contains a symbolic link.", "Reinstall the generated target.");
    if (entry.isDirectory()) result.push(...await walk(root, path));
    else if (entry.isFile()) result.push(relative(root, path).replaceAll("\\", "/"));
    else fail("ARTIFACT_INTEGRITY_FAILED", "The target contains a non-regular artifact.", "Reinstall the generated target.");
  }
  return result.sort(compareCodePoint);
}

export async function assertIntegrity(targetRoot) {
  const receipt = await readJson(resolve(targetRoot, ".skill-rails-build.json"));
  if (receipt.schemaVersion !== 1) fail("UNSUPPORTED_VERSION", "The target receipt version is unsupported.", "Install a compatible target.");
  const expected = receipt.artifacts.map((x) => x.path).sort(compareCodePoint);
  const actual = (await walk(targetRoot)).filter((x) => x !== ".skill-rails-build.json");
  if (canonicalJson(actual) !== canonicalJson(expected)) fail("ARTIFACT_INTEGRITY_FAILED", "Artifact paths differ from the receipt.", "Reinstall the generated target.");
  const rows = [];
  for (const item of receipt.artifacts) { const actualHash = sha256(await readFile(resolve(targetRoot, ...item.path.split("/")))); if (actualHash !== item.sha256) fail("ARTIFACT_INTEGRITY_FAILED", `${item.path} differs from the receipt.`, "Reinstall the generated target."); rows.push(`${item.path}\0${actualHash}\n`); }
  const tree = sha256(Buffer.from(rows.sort(compareCodePoint).join(""), "utf8"));
  if (tree !== receipt.treeSha256) fail("ARTIFACT_INTEGRITY_FAILED", "The target tree hash differs from its receipt.", "Reinstall the generated target.");
  return receipt;
}
