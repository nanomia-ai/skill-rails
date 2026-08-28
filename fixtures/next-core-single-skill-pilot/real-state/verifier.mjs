import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const modulePath = fileURLToPath(import.meta.url);
const moduleDirectory = dirname(modulePath);

function parseArgs(argv) {
  const allowed = new Set(["project", "target", "task", "snapshot", "continuation", "selection", "currentness"]);
  const parsed = {};
  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index];
    const value = argv[index + 1];
    if (!option?.startsWith("--") || value === undefined) throw new Error("Verifier arguments must be --name value pairs.");
    const key = option.slice(2);
    if (!allowed.has(key) || Object.hasOwn(parsed, key)) throw new Error(`Unsupported verifier argument: ${option}`);
    parsed[key] = value;
  }
  for (const key of allowed) if (!parsed[key]) throw new Error(`Missing verifier argument: --${key}`);
  return parsed;
}

function inside(root, path) {
  const local = relative(root, path);
  return local === "" || (!local.startsWith("..") && !isAbsolute(local));
}

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

export async function verify(argv) {
  const input = parseArgs(argv);
  const projectRoot = resolve(input.project);
  const targetPath = resolve(input.target);
  const selectionPath = resolve(input.selection);
  if (!inside(projectRoot, targetPath) || !inside(projectRoot, selectionPath)) throw new Error("Verifier inputs must remain inside the disposable project.");

  const target = JSON.parse(await readFile(targetPath, "utf8"));
  const selection = JSON.parse(await readFile(selectionPath, "utf8"));
  if (!selection || typeof selection !== "object" || Array.isArray(selection)) throw new Error("Selection must contain one locator and digest object.");
  if (typeof target?.artifact !== "string" || typeof target?.sha256 !== "string") throw new Error("Target must declare artifact and sha256.");
  if (typeof selection.locator !== "string" || typeof selection.sha256 !== "string") throw new Error("Selection must declare locator and sha256.");
  if (!new Set(["current", "stale"]).has(input.currentness)) throw new Error("Verifier currentness is outside the verifier contract.");

  const artifactPath = resolve(projectRoot, target.artifact);
  const selectedPath = resolve(projectRoot, selection.locator);
  if (!inside(projectRoot, artifactPath) || !inside(projectRoot, selectedPath)) throw new Error("Target or selection escapes the disposable project.");
  const [actualHash, selectedHash] = await Promise.all([
    readFile(artifactPath).then(sha256),
    readFile(selectedPath).then(sha256)
  ]);
  if (actualHash !== input.snapshot || target.sha256 !== input.snapshot) throw new Error("Target bytes do not match the dispatched snapshot.");
  if (target.continuation !== input.continuation) throw new Error("Target continuation does not match the dispatch.");
  if (selection.locator !== target.artifact || selection.sha256 !== selectedHash || selectedHash !== input.snapshot) {
    throw new Error("Selected locator or bytes do not match the dispatched target.");
  }

  return {
    task: input.task,
    snapshot: input.snapshot,
    selection: selection.locator,
    selectionHash: selectedHash,
    continuation: input.continuation,
    verdict: "pass",
    recordedJson: {
      currentness: input.currentness,
      detail: "selected bytes match the dispatched target"
    }
  };
}

async function main() {
  try {
    process.stdout.write(`${JSON.stringify(await verify(process.argv.slice(2)))}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

if (pathToFileURL(process.argv[1] ?? "").href === import.meta.url) await main();

export const verifierLocation = Object.freeze({ modulePath, moduleDirectory });
