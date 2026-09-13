import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { lstat, mkdir, readFile, realpath, stat } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { TextDecoder } from "node:util";

const decoder = new TextDecoder("utf-8", { fatal: true });

export class RuntimeError extends Error {
  constructor(code, message, nextAction, details) { super(message); this.code = code; this.nextAction = nextAction; this.details = details; }
}
export function fail(code, message, nextAction, details) { throw new RuntimeError(code, message, nextAction, details); }
export function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
export function compareCodePoint(a, b) {
  const left = Array.from(a); const right = Array.from(b);
  for (let i = 0; i < Math.min(left.length, right.length); i += 1) { const d = left[i].codePointAt(0) - right[i].codePointAt(0); if (d) return d; }
  return left.length - right.length;
}
export function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort(compareCodePoint).map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}
export function decodeUtf8(bytes, label, failure = {}) { try { return decoder.decode(bytes); } catch { fail(failure.code ?? "PREPARE_FAILED", `${label} is not valid UTF-8.`, failure.nextAction ?? "Correct the declared text input and run prepare again."); } }
export async function readJson(path, code = "ARTIFACT_INTEGRITY_FAILED") {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { fail(code, `${path} is missing or invalid JSON.`, "Restore the generated target or exchange from its canonical owner."); }
}
export function normalizeRelativePath(input, label) {
  if (typeof input !== "string" || !input || isAbsolute(input) || input.includes("\\")) fail("PATH_OUTSIDE_ROOT", `${label} must be a relative path with forward slashes.`, "Correct the target manifest and rebuild.");
  const parts = input.split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) fail("PATH_OUTSIDE_ROOT", `${label} has a forbidden segment.`, "Correct the target manifest and rebuild.");
  return input;
}
export async function resolveProjectPath(projectRoot, logicalPath) {
  const normalized = normalizeRelativePath(logicalPath, "project path");
  const candidate = resolve(projectRoot, ...normalized.split("/"));
  const lexical = relative(projectRoot, candidate);
  if (lexical === ".." || lexical.startsWith(`..${sep}`) || isAbsolute(lexical)) fail("PATH_OUTSIDE_ROOT", `${logicalPath} escapes the project root.`, "Correct the target manifest and rebuild.");
  let probe = candidate;
  while (true) {
    try { probe = await realpath(probe); break; } catch (error) { if (error?.code !== "ENOENT") throw error; const parent = dirname(probe); if (parent === probe) throw error; probe = parent; }
  }
  const physicalRelative = relative(projectRoot, probe);
  if (physicalRelative === ".." || physicalRelative.startsWith(`..${sep}`) || isAbsolute(physicalRelative)) fail("PATH_OUTSIDE_ROOT", `${logicalPath} resolves outside the project root.`, "Remove the escaping link or correct the target manifest.");
  return candidate;
}
export async function fileBasis(projectRoot, logicalPath) {
  const physical = await resolveProjectPath(projectRoot, logicalPath);
  try { const info = await lstat(physical); if (!info.isFile()) fail("PATH_OUTSIDE_ROOT", `${logicalPath} is not a regular file.`, "Use a regular declared input."); const bytes = await readFile(physical); return { path: logicalPath, state: "present", sha256: sha256(bytes), bytes }; }
  catch (error) { if (error?.code === "ENOENT") return { path: logicalPath, state: "absent", sha256: null, bytes: null }; throw error; }
}
export function basisPublic(item) { return { path: item.path, state: item.state, sha256: item.sha256 }; }
export async function ensureProject(project) { try { return await realpath(resolve(project)); } catch { fail("PATH_OUTSIDE_ROOT", "Project root does not exist.", "Provide an existing project directory."); } }
export async function runChild(program, args, input, failureCode) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(program, args, { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    const stdout = []; const stderr = []; let stdoutSize = 0; let settled = false;
    const finish = (fn, value) => { if (!settled) { settled = true; clearTimeout(timer); fn(value); } };
    const timer = setTimeout(() => { child.kill(); finish(rejectPromise, new RuntimeError(failureCode, `${program} timed out.`, "Inspect the domain adapter and retry.")); }, 10000);
    child.stdout.on("data", (chunk) => { stdoutSize += chunk.length; if (stdoutSize > 4 * 1024 * 1024) { child.kill(); finish(rejectPromise, new RuntimeError(failureCode, `${program} output exceeded the limit.`, "Reduce domain adapter output.")); } else stdout.push(chunk); });
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (error) => finish(rejectPromise, new RuntimeError(failureCode, error.message, "Inspect the domain adapter and retry.")));
    child.on("close", (code) => finish(resolvePromise, { code, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) }));
    child.stdin.end(input);
  });
}
export function validate(value, schema, path = "$") {
  const errors = [];
  const visit = (current, rule, at) => {
    if (rule.$ref) {
      if (!rule.$ref.startsWith("#/$defs/")) { errors.push(`${at} uses an unsupported schema reference`); return; }
      const referenced = schema.$defs?.[rule.$ref.slice("#/$defs/".length)];
      if (!referenced) { errors.push(`${at} references a missing schema definition`); return; }
      visit(current, referenced, at);
      return;
    }
    if (rule.$ref?.startsWith("#/$defs/")) {
      const resolved = schema.$defs?.[rule.$ref.slice("#/$defs/".length)];
      if (!resolved) { errors.push(`${at} uses an unresolved schema reference`); return; }
      visit(current, resolved, at);
      return;
    }
    if (rule.oneOf) { const results = rule.oneOf.map((candidate) => { const local = []; const saved = errors.splice(0); visit(current, candidate, at); local.push(...errors.splice(0)); errors.push(...saved); return local; }); if (results.filter((x) => x.length === 0).length !== 1) errors.push(`${at} must match exactly one shape`); return; }
    if (Object.hasOwn(rule, "const") && canonicalJson(current) !== canonicalJson(rule.const)) errors.push(`${at} must equal ${JSON.stringify(rule.const)}`);
    if (rule.enum && !rule.enum.some((x) => canonicalJson(x) === canonicalJson(current))) errors.push(`${at} is not allowed`);
    if (rule.type) { const actual = current === null ? "null" : Array.isArray(current) ? "array" : Number.isInteger(current) ? "integer" : typeof current; if (actual !== rule.type) { errors.push(`${at} must be ${rule.type}`); return; } }
    if (typeof current === "string") { if (rule.minLength !== undefined && current.length < rule.minLength) errors.push(`${at} is too short`); if (rule.pattern && !new RegExp(rule.pattern, "u").test(current)) errors.push(`${at} has invalid format`); }
    if (Array.isArray(current)) { if (rule.minItems !== undefined && current.length < rule.minItems) errors.push(`${at} has too few items`); if (rule.uniqueItems && new Set(current.map(canonicalJson)).size !== current.length) errors.push(`${at} has duplicates`); if (rule.items) current.forEach((x, i) => visit(x, rule.items, `${at}[${i}]`)); }
    if (current && typeof current === "object" && !Array.isArray(current)) { for (const key of rule.required ?? []) if (!Object.hasOwn(current, key)) errors.push(`${at}.${key} is required`); for (const key of Object.keys(current)) { if (rule.properties?.[key]) visit(current[key], rule.properties[key], `${at}.${key}`); else if (rule.additionalProperties === false) errors.push(`${at}.${key} is not allowed`); } }
  };
  visit(value, schema, path); return errors;
}
export function nonce() { return randomUUID(); }
export async function pathExists(path) { try { await stat(path); return true; } catch (error) { if (error?.code === "ENOENT") return false; throw error; } }
export async function ensureDirectory(path) { await mkdir(path, { recursive: true }); }
