#!/usr/bin/env node
import { TextDecoder } from "node:util";

const decoder = new TextDecoder("utf-8", { fatal: true });
const START = "<!-- skill-rails-next:verify-records:start -->";
const END = "<!-- skill-rails-next:verify-records:end -->";
const RECORD_PREFIX = "<!-- skill-rails-next:verify-record:";

function compareCodePoint(a, b) {
  const left = Array.from(a); const right = Array.from(b);
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) { const difference = left[index].codePointAt(0) - right[index].codePointAt(0); if (difference) return difference; }
  return left.length - right.length;
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort(compareCodePoint).map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

function inline(value) {
  return value.replace(/[\r\n]+/g, " ").replace(/([\\`*_[\]<>])/g, "\\$1");
}

function recordBytes(answer) {
  const encoded = Buffer.from(canonicalJson(answer), "utf8").toString("base64url");
  const checks = answer.checks.map((check) => {
    const evidence = check.evidence.length ? check.evidence.map((item) => `${item.authority}: ${item.reference}`).join("; ") : "no cited evidence";
    return `- ${inline(check.name)}: ${check.outcome} — ${inline(evidence)}`;
  });
  const unknowns = answer.unknowns.length ? answer.unknowns.map((item) => inline(item)).join("; ") : "none";
  return [
    `${RECORD_PREFIX}${encoded} -->`,
    `### ${inline(answer.cardId)} — ${answer.verdict}`,
    "",
    inline(answer.summary),
    "",
    ...checks,
    `- Unknowns: ${unknowns}`,
  ].join("\n");
}

function region(records) {
  const bodies = [...records.values()].sort((a, b) => compareCodePoint(a.cardId, b.cardId)).map(recordBytes);
  return [START, ...bodies.flatMap((body) => [body, ""]), END].join("\n").replace(/\n\n<!-- skill-rails-next:verify-records:end -->$/, "\n<!-- skill-rails-next:verify-records:end -->");
}

function locate(text) {
  const matches = [...text.matchAll(/^<!-- skill-rails-next:([a-z0-9]+(?:-[a-z0-9]+)*):(start|end) -->\r?$/gm)];
  if (matches.length === 0) return null;
  if (matches.length !== 2 || matches[0][1] !== "verify-records" || matches[0][2] !== "start" || matches[1][1] !== "verify-records" || matches[1][2] !== "end" || matches[0].index >= matches[1].index) throw new Error("MANAGED_REGION_INVALID");
  const endMarkerLength = matches[1][0].endsWith("\r") ? matches[1][0].length - 1 : matches[1][0].length;
  return { start: matches[0].index, end: matches[1].index + endMarkerLength, eol: text.slice(matches[0].index, matches[1].index).includes("\r\n") ? "\r\n" : "\n" };
}

function parseExisting(text, location) {
  if (!location) return new Map();
  const currentRegion = text.slice(location.start, location.end).replace(/\r\n/g, "\n");
  const records = new Map();
  for (const match of currentRegion.matchAll(/^<!-- skill-rails-next:verify-record:([A-Za-z0-9_-]+) -->$/gm)) {
    let answer;
    try { answer = JSON.parse(Buffer.from(match[1], "base64url").toString("utf8")); } catch { throw new Error("MANAGED_REGION_INVALID"); }
    if (!answer?.cardId || records.has(answer.cardId)) throw new Error("MANAGED_REGION_INVALID");
    records.set(answer.cardId, answer);
  }
  if (currentRegion !== region(records)) throw new Error("MANAGED_REGION_INVALID");
  return records;
}

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
try {
  const request = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  const current = decoder.decode(Buffer.from(request.currentOutputBase64, "base64"));
  const location = locate(current);
  const records = parseExisting(current, location);
  records.set(request.validatedAnswer.cardId, request.validatedAnswer);
  const desiredRegion = location?.eol === "\r\n" ? region(records).replace(/\n/g, "\r\n") : region(records);
  let desired;
  if (location) desired = `${current.slice(0, location.start)}${desiredRegion}${current.slice(location.end)}`;
  else if (current.length === 0) desired = `${desiredRegion}\n`;
  else desired = `${current}${current.endsWith("\n") ? "\n" : "\n\n"}${desiredRegion}\n`;
  process.stdout.write(desired);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
