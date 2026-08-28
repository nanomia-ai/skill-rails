import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canonicalPath, isInside } from "../scripts/skill-rails/path-policy.mjs";
import { ARTIFACTS, FORMATS } from "../spec.mjs";

const FILES = Object.freeze({
  task: ARTIFACTS.taskState.path,
  target: ARTIFACTS.targetState.path,
  channel: ARTIFACTS.channelStatus.path,
  result: ARTIFACTS.verifierResult.path,
  selection: ARTIFACTS.selectionState.path
});

const decoder = new TextDecoder("utf-8", { fatal: true });

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

async function readRaw(projectRoot, relativePath, { missing = undefined } = {}) {
  try {
    const text = decoder.decode(await readFile(join(resolve(projectRoot), relativePath)));
    if (text.charCodeAt(0) === 0xfeff) throw new Error(`${relativePath} must not contain a UTF-8 BOM.`);
    return text;
  } catch (error) {
    if (error?.code === "ENOENT" && missing !== undefined) return missing;
    throw error;
  }
}

function scalar(raw, label) {
  if (!raw || /[\r\n]/.test(raw)) throw new Error(`${label} must be one non-empty line without a terminator.`);
  return raw;
}

async function readTarget(ctx) {
  const value = JSON.parse(await readRaw(ctx.projectRoot, FILES.target));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("target.json must contain one object.");
  return value;
}

async function readSelection(ctx) {
  const value = JSON.parse(await readRaw(ctx.projectRoot, FILES.selection));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("selection.json must contain one object.");
  const locator = scalar(value.locator, "selection.json locator");
  const declaredHash = scalar(value.sha256, "selection.json sha256");
  if (!/^sha256:[0-9a-f]{64}$/.test(declaredHash)) throw new Error("selection.json sha256 must be one lowercase SHA-256 digest.");
  const projectRoot = resolve(ctx.projectRoot);
  const selectedPath = resolve(projectRoot, locator);
  const [canonicalRoot, canonicalSelectedPath] = await Promise.all([canonicalPath(projectRoot), canonicalPath(selectedPath)]);
  if (!isInside(canonicalRoot, canonicalSelectedPath)) throw new Error("selection.json locator escapes the project.");
  const hash = sha256(await readFile(canonicalSelectedPath));
  if (hash !== declaredHash) throw new Error("selection.json declared digest does not match the selected bytes.");
  return { locator, hash };
}

async function selectionFact(ctx, field) {
  return (await readSelection(ctx))[field];
}

async function readResult(ctx) {
  const raw = await readRaw(ctx.projectRoot, FILES.result, { missing: null });
  if (raw === null) return "NONE";
  if (!raw || raw.charCodeAt(0) === 0xfeff || raw.includes("\r") || !raw.endsWith("\n")) {
    throw new Error("verifier-result.log must be strict UTF-8 LF-delimited records with a final LF.");
  }
  const records = raw.slice(0, -1).split("\n");
  if (records.some(record => record.length === 0)) throw new Error("verifier-result.log must not contain blank physical records.");
  const parsedRecords = records.map((record, index) => {
    const parsed = FORMATS.verifierResult.parse(record);
    if (!parsed.ok) throw new Error("verifier-result.log record " + (index + 1) + " is not an exact verifierResult line.");
    const recordedJson = parsed.fields["recorded-json"];
    if (!recordedJson || typeof recordedJson !== "object" || Array.isArray(recordedJson) || !Object.hasOwn(recordedJson, "currentness")) {
      throw new Error("verifier-result.log record " + (index + 1) + " lacks recorded currentness.");
    }
    return {
      verdict: parsed.fields.verdict,
      task: parsed.fields.task,
      snapshot: parsed.fields.snapshot,
      selection: parsed.fields.selection,
      selectionHash: parsed.fields["selection-hash"],
      continuation: parsed.fields.continuation,
      currentness: recordedJson.currentness,
      recordedJson
    };
  });
  return parsedRecords.at(-1);
}

async function resultFact(ctx, field) {
  const result = await readResult(ctx);
  return result === "NONE" ? "NONE" : result[field];
}

export const collectors = Object.freeze({
  "evidence-credit/state.verifier-channel": async ctx => scalar(await readRaw(ctx.projectRoot, FILES.channel), "verifier-channel.txt"),
  "evidence-credit/state.task-identity": async ctx => scalar(await readRaw(ctx.projectRoot, FILES.task), "task.txt"),
  "evidence-credit/state.task-snapshot": async ctx => scalar((await readTarget(ctx)).sha256, "target.json sha256"),
  "evidence-credit/state.selection-locator": async ctx => selectionFact(ctx, "locator"),
  "evidence-credit/state.selection-hash": async ctx => selectionFact(ctx, "hash"),
  "evidence-credit/state.continuation-identity": async ctx => scalar((await readTarget(ctx)).continuation, "target.json continuation"),
  "evidence-credit/state.result-verdict": async ctx => resultFact(ctx, "verdict"),
  "evidence-credit/state.result-task": async ctx => resultFact(ctx, "task"),
  "evidence-credit/state.result-snapshot": async ctx => resultFact(ctx, "snapshot"),
  "evidence-credit/state.result-selection": async ctx => resultFact(ctx, "selection"),
  "evidence-credit/state.result-selection-hash": async ctx => resultFact(ctx, "selectionHash"),
  "evidence-credit/state.result-continuation": async ctx => resultFact(ctx, "continuation"),
  "evidence-credit/state.result-currentness": async ctx => resultFact(ctx, "currentness")
});

export const snapshotBasis = async ({ projectRoot }) => {
  const raw = async relativePath => readRaw(projectRoot, relativePath, { missing: null });
  const [task, target, channel, result, selection] = await Promise.all([
    raw(FILES.task), raw(FILES.target), raw(FILES.channel), raw(FILES.result), raw(FILES.selection)
  ]);
  return {
    kind: "evidence-credit-real-state-v1",
    raw: { task, target, channel, result, selection }
  };
};
