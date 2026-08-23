import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { exists } from "./io.mjs";
import { parseSkillMarkdown } from "./frontmatter.mjs";

export async function lintSimpleSkill(skillRoot, options = {}) {
  const root = resolve(skillRoot);
  const diagnostics = [];
  const skillPath = join(root, "SKILL.md");
  let parsed;
  try { parsed = parseSkillMarkdown(await readFile(skillPath, "utf8")); }
  catch (error) { return result([{ code: "SR_SKILL_MISSING", pointer: skillPath, message: error.message, hint: null }]); }
  diagnostics.push(...parsed.diagnostics);
  const keys = Object.keys(parsed.frontmatter ?? {});
  if (keys.sort().join("\0") !== ["description", "name"].sort().join("\0")) diagnostics.push(diag("SR_SKILL_KEYS", "SKILL.md", "Frontmatter must contain exactly name and description."));
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(parsed.frontmatter?.name ?? "")) diagnostics.push(diag("SR_SKILL_NAME", "SKILL.md:name", "Skill name must be kebab-case."));
  const description = parsed.frontmatter?.description ?? "";
  if (description.length < 20 || description.length > 1024) diagnostics.push(diag("SR_SKILL_DESCRIPTION", "SKILL.md:description", "Description must be 20–1024 characters and include trigger conditions."));
  if (/\\|[A-Za-z]:\//.test(parsed.body)) diagnostics.push(diag("SR_SKILL_PATH", "SKILL.md", "Skill instructions should use portable skill-relative paths."));
  for (const link of markdownLinks(parsed.body)) if (!(await exists(join(root, link)))) diagnostics.push(diag("SR_SKILL_LINK", `SKILL.md:${link}`, "Linked local resource does not exist."));
  const adapterPath = join(root, "agents", "openai.yaml");
  if (await exists(adapterPath)) {
    const adapter = await readFile(adapterPath, "utf8");
    for (const key of ["interface:", "display_name:", "short_description:", "default_prompt:", "policy:", "allow_implicit_invocation:"]) if (!adapter.includes(key)) diagnostics.push(diag("SR_OPENAI_ADAPTER", "agents/openai.yaml", `Missing adapter field: ${key}`));
  }

  if (options.creatorBudgets) {
    const budgets = { scripts: 6, references: 7, templates: 5 };
    for (const [directory, maximum] of Object.entries(budgets)) {
      const path = join(root, directory);
      const count = await exists(path) ? (await readdir(path, { withFileTypes: true })).filter((entry) => entry.isFile()).length : 0;
      if (count > maximum) diagnostics.push(diag("SR_CREATOR_BUDGET", directory, `${directory} has ${count} top-level files; current budget is ${maximum}.`));
    }
  }
  return result(diagnostics);
}

function markdownLinks(text) {
  return [...text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1]).filter((value) => !/^(?:https?:|#)/.test(value) && !value.includes("<"));
}
function result(diagnostics) { return { ok: diagnostics.length === 0, level: "skill", diagnostics }; }
function diag(code, pointer, message, hint = null) { return { code, pointer, message, hint, level: "error" }; }
