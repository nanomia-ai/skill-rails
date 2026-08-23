import { readFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import MarkdownIt from "markdown-it";
import referenceRule from "markdown-it/lib/rules_block/reference.mjs";
import { listFiles, readJson, writeJsonAtomic } from "./io.mjs";
import { parseSkillMarkdown } from "./frontmatter.mjs";
import { sha256 } from "../runtime/hash.mjs";

const markdown = new MarkdownIt({ html: true });
const utf8Decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
// The stock rule consumes valid definitions into env without a token; retain its accepted span in the same parser pass.
markdown.block.ruler.before("reference", "skillRailsMigrationReference", (state, startLine, endLine, silent) => {
  const accepted = referenceRule(state, startLine, endLine, silent);
  if (accepted && !silent) {
    const token = new state.Token("reference_definition", "", 0);
    token.map = [startLine, state.line];
    state.tokens.push(token);
  }
  return accepted;
});

export async function inspectProseSkill(sourceRoot) {
  const root = resolve(sourceRoot);
  const files = await listFiles(root, { exclude: [".git", "node_modules", ".skill-rails"] });
  const atoms = [];
  for (const path of files) {
    const bytes = await readFile(path);
    const text = decodeUtf8Text(bytes);
    if (!/\.md$/i.test(path) || text === null) {
      atoms.push(fileAtom(root, path, bytes, atoms.length, text));
      continue;
    }
    const source = markdownSource(text);
    const lines = sourceLines(text);
    const tokens = markdown.parse(source.body, {});
    const units = source.frontmatter ? [frontmatterUnit(source.frontmatter, text, lines)] : [];
    units.push(...semanticUnits(tokens, source.line_offset, text, lines));
    for (const unit of units) {
      atoms.push(atomRecord(root, path, unit.start, unit.end, unit.text, atoms.length, unit.kind, unit.context));
    }
  }
  return { root, files, atoms };
}

export async function inferMigrationIntent(sourceRoot, inspection) {
  const skillPath = join(resolve(sourceRoot), "SKILL.md");
  let name = basename(resolve(sourceRoot)).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "migrated-skill";
  let description = `Use ${name} when its migrated workflow and evidence boundaries apply.`;
  try {
    const parsed = parseSkillMarkdown(await readFile(skillPath, "utf8"));
    name = parsed.frontmatter?.name ?? name;
    description = parsed.frontmatter?.description ?? description;
  } catch { /* conservative defaults */ }
  const text = inspection.atoms.map((item) => item.original_text).join("\n");
  const stateful = /\b(?:if|when|unless|stage|guard|must not|before|after|until|evidence|verify)\b|(?:경우|단계|검증|증거|완료 전|금지)/i.test(text);
  return {
    name, description, problem: `Preserve the behavior of the prose source at ${resolve(sourceRoot)} without silently changing its obligations.`,
    use_cases: [], near_misses: [], inputs: [], outputs: [], irreversible_boundaries: [],
    state_dependent_behaviors: stateful ? ["Source contains candidate conditional, ordered, or evidence-bound behavior requiring review."] : [],
    exact_formats: [], external_dependencies: [], completion_evidence: [], judgment_points: ["Every source atom remains review-required until explicitly disposed."], deterministic_helpers: []
  };
}

export async function writeMigrationLedger(targetRoot, inspection) {
  const root = resolve(targetRoot);
  const path = join(root, ".skill-rails", "obligation-ledger.json");
  const ledger = await readJson(path);
  const migrationAtoms = inspection.atoms.map((atom) => ({
    id: `migration-${atom.id.toLowerCase()}`,
    source: `migration:${atom.source_path}:${atom.source_span}`,
    text: atom.original_text,
    candidate_class: atom.candidate_class,
    consequence: atom.consequence,
    disposition: "review-required",
    targets: [],
    evidence: [],
    source_hash: atom.source_hash,
    source_kind: atom.source_kind,
    context: atom.context,
    confidence: atom.confidence,
    rationale: atom.rationale,
    byte_count: atom.byte_count
  }));
  ledger.atoms.push(...migrationAtoms);
  ledger.migration = {
    source_root: inspection.root,
    source_files: inspection.files.map((file) => relative(inspection.root, file).replace(/\\/g, "/")),
    atom_count: migrationAtoms.length
  };
  await writeJsonAtomic(path, ledger);
  return { total: inspection.atoms.length, review_required: inspection.atoms.length, disposed: 0 };
}

function atomRecord(root, path, start, end, text, index, sourceKind = "paragraph", context = []) {
  const classification = classify(text, sourceKind);
  return {
    id: `A${String(index + 1).padStart(4, "0")}`,
    source_path: relative(root, path).replace(/\\/g, "/"), source_span: `${start}-${Math.max(start, end)}`,
    source_hash: sha256(text), original_text: text, candidate_class: classification.kind,
    consequence: classification.consequence, confidence: classification.confidence, rationale: classification.rationale,
    source_kind: sourceKind, context,
    target_id: null, fixture_or_review_evidence: null, disposition: "review-required"
  };
}

function fileAtom(root, path, bytes, index, text = decodeUtf8Text(bytes)) {
  const sourceKind = text === null ? "file-opaque" : "file-text";
  const originalText = text ?? `Opaque file (${bytes.byteLength} bytes); preserve, map, or dispose it explicitly before migration.`;
  const classification = classify(originalText, sourceKind);
  return {
    id: `A${String(index + 1).padStart(4, "0")}`,
    source_path: relative(root, path).replace(/\\/g, "/"), source_span: "file",
    source_hash: sha256(bytes), original_text: originalText, candidate_class: classification.kind,
    consequence: classification.consequence, confidence: classification.confidence, rationale: classification.rationale,
    source_kind: sourceKind, context: [], byte_count: bytes.byteLength,
    target_id: null, fixture_or_review_evidence: null, disposition: "review-required"
  };
}

function decodeUtf8Text(bytes) {
  try {
    const text = utf8Decoder.decode(bytes);
    return text.includes("\u0000") ? null : text;
  } catch {
    return null;
  }
}

function markdownSource(text) {
  const parsed = parseSkillMarkdown(text);
  if (!parsed.frontmatter) return { body: text, line_offset: 0, frontmatter: null };
  const prefixLength = text.length - parsed.body.length;
  const newlineWidth = text[prefixLength - 2] === "\r" ? 2 : 1;
  return {
    body: parsed.body,
    line_offset: countLineBreaks(text.slice(0, prefixLength)),
    frontmatter: { offset: 0, offset_end: prefixLength - newlineWidth }
  };
}

function sourceLines(text) {
  const lines = [];
  let start = 0;
  while (start <= text.length) {
    const lf = text.indexOf("\n", start);
    const cr = text.indexOf("\r", start);
    const newline = lf < 0 ? cr : cr < 0 ? lf : Math.min(lf, cr);
    const end = newline < 0 ? text.length : newline;
    lines.push({ start, content_end: end });
    if (newline < 0) break;
    start = newline + (text[newline] === "\r" && text[newline + 1] === "\n" ? 2 : 1);
  }
  return lines;
}

function semanticUnits(tokens, lineOffset, source, lines) {
  const units = [];
  const headings = [];
  let listDepth = 0;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type === "bullet_list_open" || token.type === "ordered_list_open") listDepth += 1;
    if (token.type === "bullet_list_close" || token.type === "ordered_list_close") listDepth = Math.max(0, listDepth - 1);

    if (token.type === "heading_open" && token.map) {
      const range = tokenRange(token.map, lineOffset, lines);
      const inline = tokens[index + 1]?.type === "inline" ? tokens[index + 1] : null;
      const heading = {
        level: Number(token.tag.slice(1)),
        text: inline?.content ?? source.slice(range.offset, range.offset_end),
        source_span: `${range.start}-${range.end}`
      };
      units.push({ ...range, kind: "heading", context: headingContext(headings), text: source.slice(range.offset, range.offset_end) });
      while (headings.length > 0 && headings.at(-1).level >= heading.level) headings.pop();
      headings.push(heading);
      continue;
    }

    if (token.type === "paragraph_open" && token.map && listDepth === 0) {
      units.push(unitFromToken(token, "paragraph", headings, source, lines, lineOffset));
      continue;
    }
    if (token.type === "reference_definition" && token.map) {
      units.push(unitFromToken(token, "reference-definition", headings, source, lines, lineOffset));
      continue;
    }
    if (token.type === "list_item_open" && token.map) {
      units.push(unitFromToken(token, "list-item", headings, source, lines, lineOffset));
      continue;
    }
    if (token.type === "tr_open" && token.map) {
      units.push(unitFromToken(token, "table-row", headings, source, lines, lineOffset));
      continue;
    }
    if (token.type === "fence" && token.map) {
      units.push(unitFromToken(token, "fenced-code", headings, source, lines, lineOffset));
      continue;
    }
    if (token.type === "code_block" && token.map) {
      units.push(unitFromToken(token, "code-block", headings, source, lines, lineOffset));
      continue;
    }
    if (token.type === "html_block" && token.map) {
      units.push(unitFromToken(token, "html-block", headings, source, lines, lineOffset));
      continue;
    }
    if (token.type === "hr" && token.map) {
      units.push(unitFromToken(token, "thematic-break", headings, source, lines, lineOffset));
    }
  }
  return units;
}

function frontmatterUnit(frontmatter, source, lines) {
  const endLine = lines.findIndex((line) => line.content_end === frontmatter.offset_end);
  if (endLine < 0) throw new Error("Frontmatter range does not align with a source line.");
  return {
    start: 1,
    end: endLine + 1,
    offset: frontmatter.offset,
    offset_end: frontmatter.offset_end,
    kind: "frontmatter",
    context: [],
    text: source.slice(frontmatter.offset, frontmatter.offset_end)
  };
}

function unitFromToken(token, kind, headings, source, lines, lineOffset) {
  const range = tokenRange(token.map, lineOffset, lines);
  return { ...range, kind, context: headingContext(headings), text: source.slice(range.offset, range.offset_end) };
}

function tokenRange(map, lineOffset, lines) {
  const startLine = map[0] + lineOffset;
  const endLine = map[1] + lineOffset;
  const first = lines[startLine];
  const last = lines[Math.max(startLine, endLine - 1)];
  if (!first || !last) throw new Error(`Markdown parser returned an invalid line map: ${map.join("-")}`);
  return {
    start: startLine + 1,
    end: Math.max(startLine + 1, endLine),
    offset: first.start,
    offset_end: last.content_end
  };
}

function headingContext(headings) {
  return headings.map(({ level, text, source_span }) => ({ level, text, source_span }));
}

function countLineBreaks(text) {
  let count = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "\n") count += 1;
    else if (text[index] === "\r") {
      count += 1;
      if (text[index + 1] === "\n") index += 1;
    }
  }
  return count;
}

function classify(text, sourceKind = null) {
  if (sourceKind === "file-text") return {
    kind: "ambiguous/review-required", consequence: "medium", confidence: 0.99,
    rationale: "A non-Markdown UTF-8 text file is one review unit; inspect, preserve, map, or dispose it explicitly."
  };
  if (sourceKind === "file-opaque") return {
    kind: "ambiguous/review-required", consequence: "high", confidence: 0.99,
    rationale: "A non-Markdown opaque file is not semantically parsed; preserve, map, or dispose it explicitly before migration."
  };
  if (sourceKind === "frontmatter") return {
    kind: "declaration", consequence: "high", confidence: 0.82,
    rationale: "Frontmatter metadata may constrain invocation, tools, compatibility, or other host behavior and needs review."
  };
  if (sourceKind === "reference-definition") return {
    kind: "declaration", consequence: "medium", confidence: 0.68,
    rationale: "A parser-consumed reference definition may affect later links, so its exact source must remain reviewable."
  };
  if (sourceKind === "table-row") return {
    kind: "table row", consequence: "medium", confidence: 0.62,
    rationale: "A table row is a structured source unit; its rule, format, or example role still needs review."
  };
  const rules = [
    [/\b(?:must not|never|forbidden|block)\b|(?:금지|해서는 안|중단)/i, "guard", "high", 0.74, "Prohibitive language may encode a guard, but scope still needs review."],
    [/\b(?:before|after|then|next|order|stage)\b|(?:먼저|이후|순서|단계)/i, "stage/done/evidence", "high", 0.70, "Ordered language may encode a stage or evidence transition."],
    [/\b(?:exact|format|template|output)\b|(?:정확한 형식|템플릿|출력)/i, "format", "medium", 0.67, "Shape language may belong in a format or template."],
    [/\b(?:if|when|unless|otherwise)\b|(?:경우|조건|아니면)/i, "ambiguous/review-required", "medium", 0.55, "Conditional prose requires a human decision between guard, table, and judgment."],
    [/^[-*]\s|\bexample\b|예시/i, "example", "low", 0.58, "List or example-like text may be a fixture rather than a rule."]
  ];
  for (const [pattern, kind, consequence, confidence, rationale] of rules) if (pattern.test(text)) return { kind, consequence, confidence, rationale };
  return { kind: "judgment/body", consequence: "low", confidence: 0.51, rationale: "No deterministic structure is safe to infer from this prose alone." };
}
