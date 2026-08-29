import { appendFile, mkdir, open, readFile, rm, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { TRACE_SCHEMA, TRACE_AUTHORITIES, TRACE_TYPES } from "./constants.mjs";
import { fail } from "./diagnostics.mjs";

const RUN_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const HASH = /^sha256:[0-9a-f]{64}$/;

export async function appendTraceEvent(traceDir, input) {
  assertRunId(input.run_id);
  const directory = resolve(traceDir);
  const path = join(directory, `${input.run_id}.jsonl`);
  await mkdir(directory, { recursive: true });
  return withLogLock(path, async () => {
    const existing = await readTrace(path);
    const event = createTraceEvent({ ...input, sequence: existing.length });
    assertValidTrace([...existing, event], input.run_id, false);
    await appendFile(path, `${JSON.stringify(event)}\n`, "utf8");
    return { path, event };
  });
}

export async function acquireTraceRunLease(traceDir, runId) {
  assertRunId(runId);
  const path = join(resolve(traceDir), `${runId}.writer`);
  await mkdir(resolve(traceDir), { recursive: true });
  let handle;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try { handle = await open(path, "wx"); break; }
    catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (attempt === 0 && await isStaleLock(path)) { await rm(path, { force: true }); continue; }
      fail("SR_TRACE_WRITER", "A stage invocation is already writing this trace run.", { pointer: path });
    }
  }
  await handle.writeFile(`${process.pid}\n${new Date().toISOString()}\n`, "utf8");
  let released = false;
  return async () => {
    if (released) return;
    released = true;
    await handle.close();
    await rm(path, { force: true });
  };
}

export function createTraceEvent(input) {
  assertRunId(input.run_id);
  if (!TRACE_AUTHORITIES.includes(input.authority)) fail("SR_TRACE_AUTHORITY", `Unknown trace authority: ${input.authority}`);
  if (!TRACE_TYPES.includes(input.type)) fail("SR_TRACE_TYPE", `Unknown trace event type: ${input.type}`);
  return {
    schema: TRACE_SCHEMA,
    event_id: input.event_id ?? randomUUID(),
    run_id: input.run_id,
    sequence: input.sequence ?? 0,
    at: input.at ?? new Date().toISOString(),
    type: input.type,
    authority: input.authority,
    decision_id: input.decision_id ?? null,
    spec_fingerprint: input.spec_fingerprint ?? null,
    snapshot_fingerprint: input.snapshot_fingerprint ?? null,
    data: input.data ?? {}
  };
}

export async function readTrace(path) {
  let text;
  try { text = await readFile(path, "utf8"); }
  catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const events = text.split(/\r?\n/).filter(Boolean).map((line, index) => {
    try { return JSON.parse(line); }
    catch (error) { fail("SR_TRACE_JSON", `Trace line ${index + 1} is not valid JSON.`, { pointer: path, cause: error }); }
  });
  const file = basename(path);
  const expectedRunId = file.endsWith(".jsonl") ? file.slice(0, -6) : null;
  assertValidTrace(events, expectedRunId, true);
  return events;
}

export function traceIntegrityIssues(events, expectedRunId = null, orderSensitive = false) {
  const issues = [];
  const ids = new Set();
  const sequences = new Set();
  const emissions = new Set();
  const runIds = new Set();
  for (const [index, event] of events.entries()) {
    const pointer = `event:${index}`;
    if (!event || typeof event !== "object" || Array.isArray(event)) { issues.push({ code: "event-shape", pointer }); continue; }
    if (event.schema !== TRACE_SCHEMA) issues.push({ code: "schema", pointer });
    if (typeof event.event_id !== "string" || event.event_id.length === 0 || ids.has(event.event_id)) issues.push({ code: "event-id", pointer });
    ids.add(event.event_id);
    if (!RUN_ID.test(event.run_id ?? "")) issues.push({ code: "run-id", pointer });
    else runIds.add(event.run_id);
    if (!Number.isInteger(event.sequence) || event.sequence < 0 || sequences.has(event.sequence)) issues.push({ code: "sequence", pointer });
    sequences.add(event.sequence);
    if (orderSensitive && event.sequence !== index) issues.push({ code: "sequence-order", pointer });
    if (!TRACE_TYPES.includes(event.type)) issues.push({ code: "type", pointer });
    if (!TRACE_AUTHORITIES.includes(event.authority)) issues.push({ code: "authority", pointer });
    if (Number.isNaN(Date.parse(event.at))) issues.push({ code: "timestamp", pointer });
    for (const field of ["decision_id", "spec_fingerprint", "snapshot_fingerprint"]) if (event[field] !== null && !HASH.test(event[field] ?? "")) issues.push({ code: field.replaceAll("_", "-"), pointer });
    if (!event.data || typeof event.data !== "object" || Array.isArray(event.data)) issues.push({ code: "data", pointer });
    if (event.type === "decision_emitted" && event.decision_id) {
      if (emissions.has(event.decision_id)) issues.push({ code: "duplicate-decision-emission", pointer });
      emissions.add(event.decision_id);
    }
  }
  if (runIds.size > 1) issues.push({ code: "mixed-run", pointer: "trace" });
  if (expectedRunId && [...runIds].some((id) => id !== expectedRunId)) issues.push({ code: "run-file-mismatch", pointer: "trace" });
  if (sequences.size > 0 && Math.max(...sequences) !== sequences.size - 1) issues.push({ code: "sequence-gap", pointer: "trace" });
  return issues;
}

function assertValidTrace(events, expectedRunId, orderSensitive) {
  const issues = traceIntegrityIssues(events, expectedRunId, orderSensitive);
  if (issues.length > 0) fail("SR_TRACE_INVALID", "Trace structure is invalid; evidence cannot be trusted.", { details: issues });
}

async function withLogLock(path, task) {
  const lockPath = `${path}.lock`;
  let acquired = false;
  for (let attempt = 0; attempt < 400; attempt += 1) {
    try {
      await mkdir(lockPath);
      acquired = true;
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (await isStaleLock(lockPath)) { await rm(lockPath, { recursive: true, force: true }); continue; }
      await new Promise((resolveWait) => setTimeout(resolveWait, 10));
    }
  }
  if (!acquired) fail("SR_TRACE_LOCK", "Timed out waiting for the trace writer lock.", { pointer: lockPath });
  try { return await task(); }
  finally { await rm(lockPath, { recursive: true, force: true }); }
}

async function isStaleLock(path) {
  try { return Date.now() - (await stat(path)).mtimeMs > 30_000; }
  catch (error) { if (error.code === "ENOENT") return false; throw error; }
}

function assertRunId(runId) {
  if (!RUN_ID.test(runId ?? "")) fail("SR_TRACE_RUN_ID", "Trace run id must be a portable identifier of at most 128 characters.", { pointer: runId });
}
