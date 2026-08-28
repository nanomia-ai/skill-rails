import { access, copyFile, lstat, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
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
    if (options.beforeInstall) await options.beforeInstall({ target, stage });
    if (await exists(target)) { await rename(target, backup); backedUp = true; }
    if (backedUp && options.verifyBackup) await options.verifyBackup({ target, stage, backup });
    await rename(stage, target);
    installed = true;
    if (backedUp) await rm(backup, { recursive: true, force: true });
    return target;
  } catch (error) {
    if (!backedUp) {
      if (await exists(stage)) await rm(stage, { recursive: true, force: true });
      throw error;
    }
    const recoveryIssues = [];
    const stagedState = await pathState(stage);
    if (stagedState.kind === "present") {
      try { await rm(stage, { recursive: true, force: true }); }
      catch (cleanupError) { recoveryIssues.push(`staged cleanup failed: ${cleanupError.message}`); }
    } else if (stagedState.kind === "unknown") recoveryIssues.push(`staged state is unknown: ${stagedState.error.message}`);
    let restored = false;
    const capturedState = await pathState(backup);
    if (!installed && capturedState.kind === "present") {
      const targetState = await pathState(target);
      if (targetState.kind === "present") recoveryIssues.push("target path is occupied; captured backup was not restored");
      else if (targetState.kind === "unknown") recoveryIssues.push(`target state is unknown; captured backup was not restored: ${targetState.error.message}`);
      else {
        try { await rename(backup, target); restored = true; }
        catch (restoreError) { recoveryIssues.push(`captured backup restore failed: ${restoreError.message}`); }
      }
    } else if (!installed && capturedState.kind === "unknown") recoveryIssues.push(`captured backup state is unknown; restore was not attempted: ${capturedState.error.message}`);
    const [targetState, finalStageState, finalBackupState] = await Promise.all([pathState(target), pathState(stage), pathState(backup)]);
    const backupDescription = restored
      ? `restored to target ${target}`
      : finalBackupState.kind === "present"
        ? `${installed ? "residual" : "preserved"} at ${backup}`
        : finalBackupState.kind === "absent"
          ? "not present"
          : `state unknown at ${backup}: ${finalBackupState.error.message}`;
    const recovery = recoveryIssues.length > 0 ? recoveryIssues.join("; ") : "no recovery obstruction";
    throw new Error(`Atomic directory install failed: ${error.message}. Recoverable state: target=${describePathState(target, targetState)}; stage=${describePathState(stage, finalStageState)}; captured_backup=${backupDescription}; installed=${installed}; recovery=${recovery}.`, { cause: error });
  }
}

export async function replaceDirectoryAtomic(targetPath, populate) {
  return createDirectoryAtomic(targetPath, populate, { replace: true, replaceNonEmpty: true });
}

export async function copyTree(sourcePath, targetPath, options = {}) {
  const source = resolve(sourcePath);
  const target = resolve(targetPath);
  const sourceRoot = options._sourceRoot ?? source;
  const filter = options.filter ?? (() => true);
  if (options.rejectUnsupportedEntries && !options._sourceRoot) await assertSupportedDirectory(source, sourceRoot);
  await mkdir(target, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const from = join(source, entry.name);
    const to = join(target, entry.name);
    const local = relative(source, from).replace(/\\/g, "/");
    if (!filter(local, entry)) continue;
    if (entry.isDirectory()) await copyTree(from, to, { ...options, _sourceRoot: sourceRoot });
    else if (entry.isFile()) { await mkdir(dirname(to), { recursive: true }); await copyFile(from, to); }
    else if (options.rejectUnsupportedEntries) throw unsupportedEntryError(sourceRoot, from, entry);
  }
}

export async function listFiles(rootPath, options = {}) {
  const root = resolve(rootPath);
  const sourceRoot = options._sourceRoot ?? root;
  if (options.rejectUnsupportedEntries && !options._sourceRoot) await assertSupportedDirectory(root, sourceRoot);
  const output = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if ((options.exclude ?? []).includes(entry.name)) continue;
    const path = join(root, entry.name);
    if (entry.isDirectory()) output.push(...await listFiles(path, { ...options, _sourceRoot: sourceRoot }));
    else if (entry.isFile()) output.push(path);
    else if (options.rejectUnsupportedEntries) throw unsupportedEntryError(sourceRoot, path, entry);
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

async function assertSupportedDirectory(path, sourceRoot) {
  const entry = await lstat(path);
  if (entry.isSymbolicLink() || !entry.isDirectory()) throw unsupportedEntryError(sourceRoot, path, entry);
}

function unsupportedEntryError(sourceRoot, path, entry) {
  const local = relative(sourceRoot, path).replace(/\\/g, "/") || ".";
  const kind = entry.isSymbolicLink() ? "symbolic link or junction" : "unsupported directory entry";
  return new Error(`Unsupported package entry ${local}: ${kind}.`);
}

async function pathState(path) {
  try { await lstat(path); return { kind: "present" }; }
  catch (error) { return error?.code === "ENOENT" ? { kind: "absent" } : { kind: "unknown", error }; }
}

function describePathState(path, state) {
  if (state.kind === "present") return `present at ${path}`;
  if (state.kind === "absent") return `absent at ${path}`;
  return `state unknown at ${path}: ${state.error.message}`;
}
