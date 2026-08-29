const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;

export function parseSkillMarkdown(text) {
  const match = text.match(FRONTMATTER);
  if (!match) return { frontmatter: null, body: text, diagnostics: [diagnostic("SR_SKILL_FRONTMATTER", "SKILL.md", "Missing YAML frontmatter.")] };
  const frontmatter = {};
  const diagnostics = [];
  for (const [index, line] of match[1].split(/\r?\n/).entries()) {
    const colon = line.indexOf(":");
    if (colon < 1) { diagnostics.push(diagnostic("SR_SKILL_FRONTMATTER", `SKILL.md:${index + 2}`, "Frontmatter must use scalar key: value pairs.")); continue; }
    const key = line.slice(0, colon).trim();
    frontmatter[key] = unquote(line.slice(colon + 1).trim());
  }
  return { frontmatter, body: text.slice(match[0].length), diagnostics };
}

export function renderSkillMarkdown({ name, description, body }) {
  return `---\nname: ${name}\ndescription: ${yamlScalar(description)}\n---\n\n${body.trim()}\n`;
}

function yamlScalar(value) {
  const text = String(value).replace(/\r?\n/g, " ").trim();
  return /[:#{}[\],&*!|>'"%@`]/.test(text) ? JSON.stringify(text) : text;
}

function unquote(value) {
  if (value.startsWith('"') && value.endsWith('"')) { try { return JSON.parse(value); } catch { return value.slice(1, -1); } }
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1).replaceAll("''", "'");
  return value;
}

function diagnostic(code, pointer, message, hint = null) { return { code, pointer, message, hint }; }
