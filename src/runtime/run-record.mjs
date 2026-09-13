#!/usr/bin/env node
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fail, RuntimeError } from "./runtime/common.mjs";
import { assertIntegrity } from "./runtime/integrity.mjs";

const targetRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function parse(argv) { const [command, ...rest] = argv; const values = {}; for (let i = 0; i < rest.length; i += 2) { if (!rest[i]?.startsWith("--") || i + 1 >= rest.length || Object.hasOwn(values, rest[i])) fail("ARGUMENT_INVALID", "Invalid or duplicate runtime argument.", "Use one documented runtime command."); values[rest[i]] = rest[i + 1]; } return { command, values }; }
function exact(values, keys) { const actual = Object.keys(values).sort().join("\0"); const expected = [...keys].sort().join("\0"); if (actual !== expected) fail("ARGUMENT_INVALID", "Runtime arguments do not match the command contract.", "Use the exact documented command."); }
async function main() {
  const { command, values } = parse(process.argv.slice(2));
  const receipt = await assertIntegrity(targetRoot);
  if (command === "check") { exact(values, []); return { schemaVersion: 1, status: "ARTIFACT_INTACT", targetId: receipt.targetId, treeSha256: receipt.treeSha256, sourceCurrent: null, remoteLatest: null }; }
  if (command === "initialize") { exact(values, ["--project"]); const { initializeRecord } = await import("./runtime/initialize-record.mjs"); return initializeRecord(targetRoot, receipt, values["--project"]); }
  if (command === "record") { exact(values, ["--exchange"]); const { record } = await import("./runtime/record.mjs"); return record(targetRoot, receipt, values["--exchange"]); }
  fail("ARGUMENT_INVALID", "Unknown runtime command.", "Use check, initialize, or record.");
}
try { process.stdout.write(`${JSON.stringify(await main())}\n`); }
catch (error) { const known = error instanceof RuntimeError; process.stdout.write(`${JSON.stringify({ schemaVersion: 1, status: "ERROR", code: known ? error.code : "INTERNAL_ERROR", message: error instanceof Error ? error.message : String(error), nextAction: known ? error.nextAction : "Inspect the generated target and retry.", ...(known && error.details !== undefined ? { details: error.details } : {}) })}\n`); process.exitCode = 1; }
