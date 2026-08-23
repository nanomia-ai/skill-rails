import { access, copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";

export async function exists(path) {
  try { await access(path, fsConstants.F_OK); return true; }
  catch { return false; }
}

export async function readJson(path) {
  try { return JSON.parse(await readFile(resolve(path), "utf8")); }
  catch (error) { throw new Error(`Cannot read JSON ${path}: ${error.message}`, { cause: error }); }
}

export async function writeTextAtomic(path, text) {
  const target = resolve(path);
  await mkdir(dirname(target), { recursive: true });
  const temporary = join(dirname(target), `.${basename(target)}.${randomUUID()}.tmp`);
  await writeFile(temporary, text, "utf8");
  await rename(temporary, target);
  return target;
}

export async function writeJsonAtomic(path, value) {
  return writeTextAtomic(path, `${JSON.stringify(value, null, 2)}\n`);
}

export async function createDirectoryAtomic(targetPath, populate, options = {}) {
  const target = safeDirectoryTarget(targetPath);
  const parent = dirname(target);
  await mkdir(parent, { recursive: true });
  if (await exists(target)) {
    if (!options.replace) throw new Error(`Output already exists: ${target}`);
    const entries = await readdir(target);
    if (entries.length > 0 && !options.replaceNonEmpty) throw new Error(`Refusing to replace a non-empty output directory: ${target}`);
  }
  const stage = join(parent, `.${basename(target)}.stage-${randomUUID()}`);
  const backup = join(parent, `.${basename(target)}.backup-${randomUUID()}`);
  await mkdir(stage, { recursive: false });
  let backedUp = false;
  let installed = false;
  try {
    await populate(stage);
    if (await exists(target)) { await rename(target, backup); backedUp = true; }
    await rename(stage, target);
    installed = true;
    if (backedUp) await rm(backup, { recursive: true, force: true });
    return target;
  } catch (error) {
    if (await exists(stage)) await rm(stage, { recursive: true, force: true });
    if (backedUp && await exists(backup)) {
      if (installed && await exists(target)) await rm(target, { recursive: true, force: true });
      if (!(await exists(target))) await rename(backup, target);
    }
    throw error;
  }
}

export async function replaceDirectoryAtomic(targetPath, populate) {
  return createDirectoryAtomic(targetPath, populate, { replace: true, replaceNonEmpty: true });
}

export async function copyTree(sourcePath, targetPath, options = {}) {
  const source = resolve(sourcePath);
  const target = resolve(targetPath);
  const filter = options.filter ?? (() => true);
  await mkdir(target, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const from = join(source, entry.name);
    const to = join(target, entry.name);
    const local = relative(source, from).replace(/\\/g, "/");
    if (!filter(local, entry)) continue;
    if (entry.isDirectory()) await copyTree(from, to, options);
    else if (entry.isFile()) { await mkdir(dirname(to), { recursive: true }); await copyFile(from, to); }
  }
}

export async function listFiles(rootPath, options = {}) {
  const root = resolve(rootPath);
  const output = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if ((options.exclude ?? []).includes(entry.name)) continue;
    const path = join(root, entry.name);
    if (entry.isDirectory()) output.push(...await listFiles(path, options));
    else if (entry.isFile()) output.push(path);
  }
  return output.sort();
}

export function isInside(parentPath, childPath) {
  const local = relative(resolve(parentPath), resolve(childPath));
  return local === "" || (local !== ".." && !local.startsWith(`..${sep}`) && !isAbsolute(local));
}

function safeDirectoryTarget(path) {
  const target = resolve(path);
  if (target === dirname(target) || basename(target) === "") throw new Error(`Unsafe directory target: ${target}`);
  return target;
}
