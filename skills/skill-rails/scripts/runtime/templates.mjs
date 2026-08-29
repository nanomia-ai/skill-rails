import { readFile } from "node:fs/promises";
import { PLACEHOLDER_KINDS } from "./constants.mjs";
import { fail } from "./diagnostics.mjs";
import { resolveInside } from "./path-policy.mjs";

const PLACEHOLDER = /\{\{([a-zA-Z][a-zA-Z0-9]*)\}\}/g;
const MARKER = /<!-- @skill-rails template id="([a-z0-9]+(?:-[a-z0-9]+)*)" -->\s*\n```(?:markdown|md)?\n([\s\S]*?)\n```/g;

export function extractInlineTemplates(markdown) {
  return Object.fromEntries([...markdown.matchAll(MARKER)].map((match) => [match[1], match[2]]));
}

export function placeholderNames(text) {
  return [...text.matchAll(PLACEHOLDER)].map((match) => match[1]);
}

export async function resolveTemplate(skillRoot, id, declaration, bodyMarkdown = "") {
  if (declaration.inline) {
    const templates = extractInlineTemplates(bodyMarkdown);
    if (!(declaration.inline in templates)) fail("L11", `Inline template marker not found: ${declaration.inline}`, { pointer: `TEMPLATES.${id}` });
    return templates[declaration.inline];
  }
  if (declaration.file) {
    const path = await resolveInside(skillRoot, declaration.file, { code: "L11" });
    try { return await readFile(path, "utf8"); }
    catch (error) { fail("L11", `Template file not found: ${declaration.file}`, { pointer: `TEMPLATES.${id}`, cause: error }); }
  }
  fail("L11", `Template ${id} must declare inline or file.`, { pointer: `TEMPLATES.${id}` });
}

export function validateTemplateDeclaration(id, declaration, text) {
  const diagnostics = [];
  if (declaration.example === true) return diagnostics;
  const fields = declaration.fields ?? {};
  const declared = Object.keys(fields).sort();
  const actual = [...new Set(placeholderNames(text))].sort();
  if (declared.join("\0") !== actual.join("\0")) {
    diagnostics.push({ code: "L11", pointer: `TEMPLATES.${id}.fields`, message: `Placeholder set differs: declared=${declared.join(",")} actual=${actual.join(",")}` });
  }
  for (const [name, kind] of Object.entries(fields)) {
    if (!PLACEHOLDER_KINDS.includes(kind)) diagnostics.push({ code: "L11", pointer: `TEMPLATES.${id}.fields.${name}`, message: `Unknown placeholder kind: ${kind}` });
  }
  if (/\{\{\s*(?:if|for|each|else)\b/i.test(text)) diagnostics.push({ code: "L11", pointer: `TEMPLATES.${id}`, message: "Template control syntax is forbidden." });
  const outside = withoutFences(text);
  let previous = -1;
  for (const heading of declaration.sections ?? []) {
    const matches = [...outside.matchAll(new RegExp(`^${escapeRegExp(heading)}\\s*$`, "gm"))];
    if (matches.length !== 1 || matches[0].index <= previous) diagnostics.push({ code: "L11", pointer: `TEMPLATES.${id}.sections`, message: `Fixed heading must appear exactly once and in order: ${heading}` });
    previous = matches[0]?.index ?? previous;
  }
  if (!text.endsWith("\n")) diagnostics.push({ code: "L11", pointer: `TEMPLATES.${id}`, message: "Template file must end with a newline." });
  return diagnostics;
}

export function renderTemplate(text, declaration, values) {
  let output = text;
  for (const [name, kind] of Object.entries(declaration.fields ?? {})) {
    if (!(name in values)) fail("SR_TEMPLATE_MISSING", `Missing template field: ${name}`);
    const value = String(values[name]);
    if ((kind === "line" || kind === "generated") && /[\r\n]/.test(value)) fail("SR_TEMPLATE_LINE", `Template field ${name} must be one line.`);
    if (kind === "block") {
      if (/^```/m.test(value)) fail("SR_TEMPLATE_FENCE", `Template block ${name} may not contain a fence delimiter.`);
      for (const heading of declaration.sections ?? []) if (new RegExp(`^${escapeRegExp(heading)}\\s*$`, "m").test(value)) fail("SR_TEMPLATE_HEADING", `Template block ${name} duplicates fixed heading ${heading}.`);
    }
    output = output.replaceAll(`{{${name}}}`, value);
  }
  if (/\{\{[a-zA-Z]/.test(output)) fail("SR_TEMPLATE_UNFILLED", "Rendered template contains unfilled placeholders.");
  return output;
}

function withoutFences(text) {
  let inFence = false;
  return text.split(/\r?\n/).filter((line) => {
    if (/^```/.test(line)) { inFence = !inFence; return false; }
    return !inFence;
  }).join("\n");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
