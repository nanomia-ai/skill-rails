import { realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fail } from "./diagnostics.mjs";

export function isPortableRelativePath(value) {
  if (typeof value !== "string" || value.length === 0 || isAbsolute(value) || value.includes("\\") || value.includes(":")) return false;
  return value.split("/").every((segment) => segment && segment !== "." && segment !== "..");
}

export async function normalizeProjectTarget(root, value, options = {}) {
  const code = options.code ?? "SR_STAGE_TARGET";
  if (typeof value !== "string" || value.length === 0 || value.includes("\0") || isAbsolute(value) || value.includes("\\") || value.includes(":")) {
    fail(code, `Stage target must be a portable project-relative path: ${value}`, { pointer: value });
  }
  const segments = value.split("/");
  if (segments.includes("..")) fail(code, `Stage target may not contain parent traversal: ${value}`, { pointer: value });
  const normalized = segments.filter((segment) => segment && segment !== ".").join("/");
  if (!normalized) fail(code, `Stage target must identify a path below the project root: ${value}`, { pointer: value });
  await resolveInside(root, normalized, { code });
  return normalized;
}

export async function resolveInside(root, local, options = {}) {
  if (!isPortableRelativePath(local)) fail(options.code ?? "SR_PATH", `Path must be a portable package-relative path: ${local}`, { pointer: local });
  const lexicalRoot = resolve(root);
  const lexicalTarget = resolve(lexicalRoot, local);
  if (!isInside(lexicalRoot, lexicalTarget)) fail(options.code ?? "SR_PATH", `Path escapes its declared root: ${local}`, { pointer: local });
  const [canonicalRoot, canonicalTarget] = await Promise.all([canonicalPath(lexicalRoot), canonicalPath(lexicalTarget)]);
  if (!isInside(canonicalRoot, canonicalTarget)) fail(options.code ?? "SR_PATH", `Path escapes its declared root through a symlink or junction: ${local}`, { pointer: local });
  return lexicalTarget;
}

export function isInside(parent, child) {
  const local = relative(resolve(parent), resolve(child));
  return local === "" || (local !== ".." && !local.startsWith(`..${sep}`) && !isAbsolute(local));
}

export async function canonicalPath(path) {
  const target = resolve(path);
  try { return await realpath(target); }
  catch {
    const parent = resolve(target, "..");
    if (parent === target) return target;
    return resolve(await canonicalPath(parent), target.slice(parent.length).replace(/^[\\/]+/, ""));
  }
}
