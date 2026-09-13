#!/usr/bin/env node
import { TextDecoder } from "node:util";

const decoder = new TextDecoder("utf-8", { fatal: true });
const START = "<!-- skill-rails-next:editorial-review:start -->";
const END = "<!-- skill-rails-next:editorial-review:end -->";
const RECORD_PREFIX = "<!-- skill-rails-next:editorial-review-record:";

function compareCodePoint(left, right) {
  const a = Array.from(left); const b = Array.from(right);
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) { const difference = a[index].codePointAt(0) - b[index].codePointAt(0); if (difference) return difference; }
  return a.length - b.length;
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort(compareCodePoint).map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

function inline(value) {
  return value.replace(/[\r\n]+/g, " ").replace(/([\\`*_[\]<>])/g, "\\$1");
}

function region(answer) {
  const encoded = Buffer.from(canonicalJson(answer), "utf8").toString("base64url");
  const issues = answer.issues.length ? answer.issues.map((item) => `- ${item.kind}: ${inline(item.note)}`) : ["- Issues: none"];
  const unknowns = answer.unknowns.length ? answer.unknowns.map(inline).join("; ") : "none";
  return [
    START,
    `${RECORD_PREFIX}${encoded} -->`,
    `### ${inline(answer.documentId)} — ${answer.verdict}`,
    "",
    inline(answer.summary),
    "",
    ...issues,
    `- Unknowns: ${unknowns}`,
    END,
  ].join("\n");
}

function locate(text) {
  const starts = [...text.matchAll(/^<!-- skill-rails-next:editorial-review:start -->\r?$/gm)];
  const ends = [...text.matchAll(/^<!-- skill-rails-next:editorial-review:end -->\r?$/gm)];
  if (starts.length === 0 && ends.length === 0) return null;
  if (starts.length !== 1 || ends.length !== 1 || starts[0].index >= ends[0].index) throw new Error("MANAGED_REGION_INVALID");
  const endLength = ends[0][0].endsWith("\r") ? ends[0][0].length - 1 : ends[0][0].length;
  return { start: starts[0].index, end: ends[0].index + endLength, eol: text.slice(starts[0].index, ends[0].index).includes("\r\n") ? "\r\n" : "\n" };
}

function validateExisting(text, location) {
  if (!location) return;
  const current = text.slice(location.start, location.end).replace(/\r\n/g, "\n");
  const match = current.match(/^<!-- skill-rails-next:editorial-review:start -->\n<!-- skill-rails-next:editorial-review-record:([A-Za-z0-9_-]+) -->/);
  if (!match) throw new Error("MANAGED_REGION_INVALID");
  let answer;
  try { answer = JSON.parse(Buffer.from(match[1], "base64url").toString("utf8")); } catch { throw new Error("MANAGED_REGION_INVALID"); }
  if (current !== region(answer)) throw new Error("MANAGED_REGION_INVALID");
}

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
try {
  const request = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  const current = decoder.decode(Buffer.from(request.currentOutputBase64, "base64"));
  const location = locate(current);
  validateExisting(current, location);
  const nextRegion = location?.eol === "\r\n" ? region(request.validatedAnswer).replace(/\n/g, "\r\n") : region(request.validatedAnswer);
  const desired = location
    ? `${current.slice(0, location.start)}${nextRegion}${current.slice(location.end)}`
    : current.length === 0
      ? `${nextRegion}\n`
      : `${current}${current.endsWith("\n") ? "\n" : "\n\n"}${nextRegion}\n`;
  process.stdout.write(desired);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
