import { createHash } from "node:crypto";
import { TextDecoder } from "node:util";
import { fail } from "./errors.mjs";

const utf8 = new TextDecoder("utf-8", { fatal: true });

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
export function canonicalText(bytes, logicalPath) {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    fail("SOURCE_TEXT_INVALID", `${logicalPath} has a UTF-8 BOM.`, "Remove the BOM from the canonical source.");
  }
  let text;
  try {
    text = utf8.decode(bytes);
  } catch {
    fail("SOURCE_TEXT_INVALID", `${logicalPath} is not valid UTF-8 text.`, "Use UTF-8 text without binary bytes.");
  }
  if (text.includes("\0")) {
    fail("SOURCE_TEXT_INVALID", `${logicalPath} contains a NUL byte.`, "Move binary input outside the v1 source package.");
  }
  return text.replace(/\r\n?/g, "\n");
}

export function compareCodePoint(a, b) {
  const aa = Array.from(a);
  const bb = Array.from(b);
  for (let index = 0; index < Math.min(aa.length, bb.length); index += 1) {
    const difference = aa[index].codePointAt(0) - bb[index].codePointAt(0);
    if (difference !== 0) return difference;
  }
  return aa.length - bb.length;
}

export function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort(compareCodePoint).map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

export function treeSha256(artifacts) {
  const rows = [...artifacts.entries()]
    .sort(([left], [right]) => compareCodePoint(left, right))
    .map(([path, bytes]) => `${path}\0${sha256(bytes)}\n`)
    .join("");
  return sha256(Buffer.from(rows, "utf8"));
}
