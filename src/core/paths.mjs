import { lstat, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fail } from "./errors.mjs";

export function normalizeRelativePath(input, label = "path") {
  if (typeof input !== "string" || input.length === 0 || isAbsolute(input) || input.includes("\\")) {
    fail("PATH_OUTSIDE_ROOT", `${label} must be a non-empty relative path using forward slashes.`, "Correct the canonical manifest path.");
  }
  const parts = input.split("/");
  if (parts.some((part) => part.length === 0 || part === "." || part === "..")) {
    fail("PATH_OUTSIDE_ROOT", `${label} contains an empty, dot, or traversal segment: ${input}`, "Correct the canonical manifest path.");
  }
  return parts.join("/");
}

export async function sourceRootFor(manifestPath) {
  const manifestReal = await realpath(resolve(manifestPath));
  return { manifestReal, rootReal: await realpath(dirname(manifestReal)) };
}

export async function resolveContainedFile(rootReal, relativePath, label = "source path") {
  return resolveContainedFileFrom(rootReal, rootReal, relativePath, label);
}

export async function resolveContainedFileFrom(rootReal, baseReal, relativePath, label = "source path") {
  if (typeof relativePath !== "string" || relativePath.length === 0 || isAbsolute(relativePath) || relativePath.includes("\\")) {
    fail("PATH_OUTSIDE_ROOT", `${label} must be a non-empty relative path using forward slashes.`, "Correct the canonical manifest path.");
  }
  const parts = relativePath.split("/");
  if (parts.some((part) => part.length === 0 || part === ".")) {
    fail("PATH_OUTSIDE_ROOT", `${label} contains an empty or dot segment: ${relativePath}`, "Correct the canonical manifest path.");
  }
  const candidate = resolve(baseReal, ...parts);
  let physical;
  try {
    physical = await realpath(candidate);
  } catch {
    fail("SOURCE_PATH_MISSING", `${label} does not exist: ${relativePath}`, "Add the declared source file or correct its path.");
  }
  const fromRoot = relative(rootReal, physical);
  if (fromRoot === "" || fromRoot.startsWith(`..${sep}`) || fromRoot === ".." || isAbsolute(fromRoot)) {
    fail("PATH_OUTSIDE_ROOT", `${label} escapes the source root: ${relativePath}`, "Keep every source path inside its package root.");
  }
  const stats = await lstat(physical);
  if (!stats.isFile()) {
    fail("SOURCE_PATH_INVALID", `${label} is not a regular file: ${relativePath}`, "Use a regular file source.");
  }
  return { normalized: relative(rootReal, physical).replaceAll("\\", "/"), targetRelative: relativePath, physical };
}

export function assertNoCaseFoldCollisions(entries, label) {
  const seen = new Map();
  for (const entry of entries) {
    const folded = entry.toLocaleLowerCase("en-US");
    if (seen.has(folded) && seen.get(folded) !== entry) {
      fail("CASE_COLLISION", `${label} collide by case: ${seen.get(folded)} and ${entry}`, "Rename one canonical identifier or path.");
    }
    seen.set(folded, entry);
  }
}
