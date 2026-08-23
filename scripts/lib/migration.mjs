import { readFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { listFiles, readJson, writeJsonAtomic } from "./io.mjs";
import { parseSkillMarkdown } from "./frontmatter.mjs";
import { sha256 } from "../runtime/hash.mjs";

export async function inspectProseSkill(sourceRoot) {
  const root = resolve(sourceRoot);
  const files = (await listFiles(root, { exclude: [".git", "node_modules", ".skill-rails"] })).filter((path) => /\.md$/i.test(path));
  const atoms = [];
  for (const path of files) {
    const text = await readFile(path, "utf8");
    const lines = text.split(/\r?\n/);
    let start = 0;
    for (let index = 0; index <= lines.length; index += 1) {
      if (index < lines.length && lines[index].trim() !== "") continue;
      const value = lines.slice(start, index).join("\n").trim();
      if (value && !/^---$/.test(value)) atoms.push(atomRecord(root, path, start + 1, index, value, atoms.length));
      start = index + 1;
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
    confidence: atom.confidence,
    rationale: atom.rationale
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

function atomRecord(root, path, start, end, text, index) {
  const classification = classify(text);
  return {
    id: `A${String(index + 1).padStart(4, "0")}`,
    source_path: relative(root, path).replace(/\\/g, "/"), source_span: `${start}-${Math.max(start, end)}`,
    source_hash: sha256(text), original_text: text, candidate_class: classification.kind,
    consequence: classification.consequence, confidence: classification.confidence, rationale: classification.rationale,
    target_id: null, fixture_or_review_evidence: null, disposition: "review-required"
  };
}

function classify(text) {
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
