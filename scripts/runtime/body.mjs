import { readFile } from "node:fs/promises";
import { BODY_KINDS } from "./constants.mjs";
import { sha256 } from "./hash.mjs";
import { fail } from "./diagnostics.mjs";

const SECTION = /^## (guard|stage|role|why): ([a-z0-9]+(?:-[a-z0-9]+)*)\s*$/gm;

export function parseBody(markdown, path = "body.md") {
  const matches = [...markdown.matchAll(SECTION)];
  const allHeadings = [...markdown.matchAll(/^## (.+)$/gm)].map((match) => ({ title: match[1].trim(), index: match.index }));
  const sections = [];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const start = match.index;
    const end = matches[index + 1]?.index ?? markdown.length;
    const kind = match[1];
    const id = match[2];
    const content = markdown.slice(start, end).trimEnd();
    sections.push({ kind, id, ref: `${kind}: ${id}`, markdown: content, hash: sha256(content), start, end, path });
  }
  const recognizedTitles = new Set(sections.map((section) => `${section.kind}: ${section.id}`));
  const invalidHeadings = allHeadings.filter(({ title }) => !recognizedTitles.has(title));
  const duplicates = sections.filter((section, index) => sections.findIndex((item) => item.ref === section.ref) !== index);
  return { sections, invalidHeadings, duplicates, markdown, path };
}

export async function loadBody(skillRoot, language = "en") {
  const filename = language === "ko" ? "body_ko.md" : "body.md";
  const path = new URL(filename, directoryUrl(skillRoot));
  let markdown;
  try { markdown = await readFile(path, "utf8"); }
  catch (error) {
    fail("L7", `Missing ${filename}`, { pointer: filename, cause: error });
  }
  return parseBody(markdown, filename);
}

export function resolveBodySection(parsed, reference, currentSkill) {
  const qualified = reference.includes("#") ? reference.split("#", 2) : [currentSkill, reference];
  if (qualified[0] !== currentSkill) {
    fail("SR_SINGLE_PROFILE_REFERENCE", `Foreign body reference is forbidden in the single profile: ${reference}`, { pointer: reference });
  }
  const section = parsed.sections.find((item) => item.ref === qualified[1]);
  if (!section) fail("L7", `Body section does not exist: ${reference}`, { pointer: reference });
  return section;
}

export function validateBodyKinds(parsed) {
  return parsed.invalidHeadings.map(({ title }) => ({ code: "L7", pointer: `${parsed.path}#${title}`, message: `Only ${BODY_KINDS.join(", ")} level-two sections are allowed.` }));
}

function directoryUrl(path) {
  const url = path instanceof URL ? path : new URL(`file:///${String(path).replace(/\\/g, "/")}${String(path).endsWith("/") ? "" : "/"}`);
  return url;
}
