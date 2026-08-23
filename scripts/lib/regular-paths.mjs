import { lstat, readFile, readdir } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

export function isPortablePackagePath(value) {
  return typeof value === "string"
    && value.length > 0
    && !isAbsolute(value)
    && !value.includes("\\")
    && !value.includes(":")
    && value.split("/").every((segment) => segment && segment !== "." && segment !== "..");
}

export async function resolveRegularInside(rootPath, local, kind = "file") {
  if (!isPortablePackagePath(local)) throw pathError(`Path must be a portable package-relative path: ${local}`);
  const root = resolve(rootPath);
  const target = resolve(root, ...local.split("/"));
  if (!isInside(root, target)) throw pathError(`Path escapes the skill package: ${local}`);
  let cursor = root;
  for (const segment of local.split("/")) {
    cursor = join(cursor, segment);
    let value;
    try { value = await lstat(cursor); }
    catch { throw pathError(`Path does not exist: ${local}`); }
    if (value.isSymbolicLink()) throw pathError(`Path uses a symlink or junction: ${local}`);
  }
  const value = await lstat(target);
  if (kind === "file" && !value.isFile()) throw pathError(`Path is not a regular file: ${local}`);
  if (kind === "directory" && !value.isDirectory()) throw pathError(`Path is not a regular directory: ${local}`);
  return target;
}

export async function readUtf8RegularInside(root, local) {
  const path = await resolveRegularInside(root, local, "file");
  const bytes = await readFile(path);
  try { return { path, bytes, text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) }; }
  catch { throw pathError(`File is not valid UTF-8 text: ${local}`); }
}

export async function inventoryFlatMarkdown(root, directoryLocal) {
  let directory;
  try { directory = await resolveRegularInside(root, directoryLocal, "directory"); }
  catch (error) {
    if (/does not exist/.test(error.message)) return { exists: false, files: [], issues: [] };
    return { exists: true, files: [], issues: [{ path: directoryLocal, message: error.message }] };
  }
  const files = [];
  const issues = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const local = `${directoryLocal}/${entry.name}`;
    if (entry.isSymbolicLink()) issues.push({ path: local, message: `Routing directories may not contain symlinks or junctions: ${local}` });
    else if (entry.isDirectory()) issues.push({ path: local, message: `Routing topics must be top-level files, not nested directories: ${local}` });
    else if (!entry.isFile()) issues.push({ path: local, message: `Routing material must be a regular file: ${local}` });
    else if (/\.md$/i.test(entry.name)) files.push({ local, name: entry.name, path: join(directory, entry.name) });
  }
  files.sort((left, right) => left.local < right.local ? -1 : left.local > right.local ? 1 : 0);
  return { exists: true, files, issues };
}

function isInside(parent, child) {
  const local = relative(resolve(parent), resolve(child));
  return local === "" || (local !== ".." && !local.startsWith(`..${sep}`) && !isAbsolute(local));
}

function pathError(message) {
  const error = new Error(message);
  error.code = "SR_REGULAR_PATH";
  return error;
}
