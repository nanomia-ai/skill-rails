import { Buffer } from "node:buffer";
import { canonicalJson, sha256 } from "./canonicalize.mjs";
import { fail } from "./errors.mjs";

function markdownHeadings(text) {
  const headings = [];
  let byteOffset = 0;
  for (const line of text.split(/(?<=\n)/u)) {
    const body = line.endsWith("\n") ? line.slice(0, -1) : line;
    const match = /^(#{2,3})[ \t]+(.+?)[ \t]*#*[ \t]*$/u.exec(body);
    if (match) headings.push({ level: match[1].length, text: match[2], startByte: byteOffset });
    byteOffset += Buffer.byteLength(line, "utf8");
  }
  return headings;
}

export function buildHeadingIndex(module) {
  const headings = markdownHeadings(module.text);
  const numbered = [];
  const seen = new Set();
  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    const number = /^(\d+(?:\.\d+)*)(?:\.|\s|$)/u.exec(heading.text)?.[1];
    if (!number) continue;
    if (seen.has(number)) fail("HEADING_INDEX_INVALID", `${module.path} repeats selectable section ${number}.`, "Give numbered H2/H3 headings unique section numbers.");
    seen.add(number);
    const next = headings.slice(index + 1).find((candidate) => candidate.level <= heading.level);
    numbered.push({ ...heading, sectionId: number, endByte: next?.startByte ?? module.bytes.length });
  }
  if (numbered.length === 0) fail("HEADING_INDEX_INVALID", `${module.path} has no numbered H2/H3 headings.`, "Index a source with numbered H2/H3 headings or omit headingIndex.");

  const firstH2 = headings.find((heading) => heading.level === 2);
  const sections = [{
    sectionId: "preamble",
    headingText: null,
    level: 1,
    parent: null,
    startByte: 0,
    endByte: firstH2?.startByte ?? module.bytes.length,
  }];
  let nearestH2 = null;
  for (const heading of numbered) {
    if (heading.level === 2) nearestH2 = heading.sectionId;
    sections.push({
      sectionId: heading.sectionId,
      headingText: heading.text,
      level: heading.level,
      parent: heading.level === 2 ? "preamble" : nearestH2 ?? "preamble",
      startByte: heading.startByte,
      endByte: heading.endByte,
    });
  }
  for (const section of sections) section.sha256 = sha256(module.bytes.subarray(section.startByte, section.endByte));
  return Buffer.from(`${canonicalJson({
    schemaVersion: 1,
    source: { moduleId: module.id, path: module.path, byteLength: module.bytes.length, sha256: sha256(module.bytes) },
    sections,
  })}\n`, "utf8");
}
