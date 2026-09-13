#!/usr/bin/env node
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fail, RuntimeError } from "./runtime/common.mjs";
import { assertIntegrity } from "./runtime/integrity.mjs";

const targetRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function parse(argv) { const [command, ...rest] = argv; const values = {}; for (let i = 0; i < rest.length; i += 2) { if (!rest[i]?.startsWith("--") || i + 1 >= rest.length || Object.hasOwn(values, rest[i])) fail("ARGUMENT_INVALID", "Invalid or duplicate runtime argument.", "Use the check command without arguments."); values[rest[i]] = rest[i + 1]; } return { command, values }; }
async function main() {
  const { command, values } = parse(process.argv.slice(2));
  const receipt = await assertIntegrity(targetRoot);
  if (command === "check" && Object.keys(values).length === 0) return { schemaVersion: 1, status: "ARTIFACT_INTACT", targetId: receipt.targetId, treeSha256: receipt.treeSha256, sourceCurrent: null, remoteLatest: null };
  fail("ARGUMENT_INVALID", "Unknown check-only runtime command.", "Use check without arguments.");
}
try { process.stdout.write(`${JSON.stringify(await main())}\n`); }
catch (error) { const known = error instanceof RuntimeError; process.stdout.write(`${JSON.stringify({ schemaVersion: 1, status: "ERROR", code: known ? error.code : "INTERNAL_ERROR", message: error instanceof Error ? error.message : String(error), nextAction: known ? error.nextAction : "Inspect the generated target and retry.", ...(known && error.details !== undefined ? { details: error.details } : {}) })}\n`); process.exitCode = 1; }
