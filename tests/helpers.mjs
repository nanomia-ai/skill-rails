import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";

export const repositoryRoot = resolve(import.meta.dirname, "..");

export async function temporary(t, prefix) {
  const path = await mkdtemp(join(tmpdir(), `skill-rails-next-${prefix}-`));
  t.after(() => rm(path, { recursive: true, force: true }));
  return path;
}

export function runNode(args, options = {}) {
  const result = spawnSync(process.execPath, args, { cwd: repositoryRoot, encoding: "utf8", ...options });
  const lines = result.stdout.trim().split(/\r?\n/u).filter(Boolean);
  let json;
  try { json = JSON.parse(lines.at(-1)); } catch { json = null; }
  return { ...result, json };
}

export async function fileMap(root, current = root) {
  const result = new Map();
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const path = join(current, entry.name);
    if (entry.isDirectory()) for (const [key, value] of await fileMap(root, path)) result.set(key, value);
    else if (entry.isFile()) result.set(relative(root, path).replaceAll("\\", "/"), await readFile(path));
  }
  return result;
}

export function coreCli(...args) {
  return runNode(["src/core/cli.mjs", ...args]);
}
