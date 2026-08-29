import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { lstat, readdir, readlink } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { hashFile, sha256 } from "./hash.mjs";

const execFileAsync = promisify(execFile);

export async function captureSnapshot(projectRoot, snapshotBasis = null) {
  const root = resolve(projectRoot);
  const material = snapshotBasis ? await snapshotBasis({ projectRoot: root }) : await defaultBasis(root);
  return {
    fingerprint: sha256(material),
    material,
    captured_at: new Date().toISOString()
  };
}

export function compareSnapshots(start, end) {
  return {
    status: start.fingerprint === end.fingerprint ? "stable" : "stale",
    fingerprint: end.fingerprint,
    start_fingerprint: start.fingerprint,
    end_fingerprint: end.fingerprint
  };
}

async function defaultBasis(root) {
  try {
    const [head, status, worktrees] = await Promise.all([
      git(root, ["rev-parse", "HEAD"]),
      git(root, ["status", "--porcelain=v1", "--untracked-files=all"]),
      git(root, ["worktree", "list", "--porcelain"])
    ]);
    return { kind: "git", root, head: head.trim(), status, worktrees };
  } catch {
    return { kind: "filesystem", root, entries: await recursiveFileBasis(root) };
  }
}

async function git(cwd, args) {
  const { stdout } = await execFileAsync("git", args, { cwd, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  return stdout;
}

async function recursiveFileBasis(root, directory = root) {
  const names = (await readdir(directory)).filter((name) => ![".git", ".skill-rails", "node_modules"].includes(name)).sort();
  const entries = [];
  for (const name of names) {
    const path = join(directory, name);
    const local = relative(root, path).replace(/\\/g, "/");
    const value = await lstat(path);
    if (value.isSymbolicLink()) entries.push({ path: local, type: "symlink", target: await readlink(path) });
    else if (value.isDirectory()) {
      entries.push({ path: local, type: "directory" });
      entries.push(...await recursiveFileBasis(root, path));
    } else if (value.isFile()) entries.push({ path: local, type: "file", size: value.size, hash: await hashFile(path) });
    else entries.push({ path: local, type: "other", size: value.size });
  }
  return entries;
}
