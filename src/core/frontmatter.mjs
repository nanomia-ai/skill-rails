import { fail } from "./errors.mjs";

// Limits every supported host shares (Agent Skills format: Claude Code, Codex); a host skips or rejects a skill that breaks them.
const NAME_LIMIT = 64;
const DESCRIPTION_LIMIT = 1024;

// Only forms that YAML reads as text for certain are accepted, so the build checks the value every host reads; anything
// else asks to be quoted. A plain value starts with a letter and is no YAML word, or starts with a digit and holds a space
// but is no timestamp, and never holds a key or value marker.
const YAML_WORD = /^(?:yes|no|true|false|on|off|null)$/iu;
const TIMESTAMP = /^\d{4}-\d\d?-\d\d?(?:[Tt]|[ \t]+)\d\d?:\d\d:\d\d(?:\.\d*)?(?:[ \t]*(?:Z|[-+]\d\d?(?::\d\d)?))?$/u;
const PLAIN_TEXT = (value) => (/^\p{L}/u.test(value) ? !YAML_WORD.test(value) : /^\p{Nd}/u.test(value) && /\s/u.test(value) && !TIMESTAMP.test(value));

// YAML folding: a line break between two lines becomes a space, and each blank line between them a line break.
function fold(lines) {
  let folded = lines[0];
  let breaks = 0;
  for (const line of lines.slice(1)) {
    if (!line) { breaks += 1; continue; }
    folded += (breaks ? "\n".repeat(breaks) : " ") + line;
    breaks = 0;
  }
  return folded;
}

// One top-level text value, or null when it is not certainly text; the other keys stay host-owned and are kept as written.
function scalar(lines, key) {
  const spelled = lines.filter((line) => new RegExp(`^(?:${key}|'${key}'|"${key}")\\s*:`, "u").test(line));
  const at = lines.flatMap((line, index) => (line.startsWith(`${key}:`) ? [index] : []));
  if (!spelled.length) return undefined;
  if (spelled.length > 1 || at.length !== 1 || !/^\s|^$/u.test(lines[at[0]].slice(key.length + 1))) return null;
  const head = lines[at[0]].slice(key.length + 1).trim();
  const rest = [];
  for (const line of lines.slice(at[0] + 1)) {
    if (line !== "" && !/^\s/u.test(line)) break;
    if (/^ *\t/u.test(line)) return null;
    rest.push(line);
  }
  const filled = rest.filter((line) => line.trim() !== "");
  if (/^[|>][-+]?(?:\s+#.*)?$/u.test(head)) {
    const indent = filled.length ? filled[0].match(/^ */u)[0].length : 0;
    if (filled.some((line) => line.match(/^ */u)[0].length < indent) || (head[0] === ">" && filled.some((line) => line.match(/^ */u)[0].length > indent))) return null;
    const body = rest.map((line) => line.slice(indent)).join("\n").replace(/\n+$/u, "");
    return head[0] === "|" ? body : fold(body.split("\n"));
  }
  const joined = [head, ...filled.map((line) => line.trim())].filter(Boolean).join(" ");
  if (/^['"]/u.test(joined)) {
    // A quoted value may span lines; YAML folds each line break into a space and each blank line into a break.
    const raw = [head, ...rest].join("\n").trim();
    const quoted = raw[0] === "'" ? /^'((?:[^']|'')*)'/u.exec(raw) : /^"((?:[^"\\]|\\[^])*)"/u.exec(raw);
    if (!quoted || !/^(?:\s+#.*)?$/u.test(raw.slice(quoted[0].length))) return null;
    const inner = raw[0] === '"' ? quoted[1].replace(/\\\n[ \t]*/gu, "") : quoted[1];
    const lines = inner.split("\n");
    const folded = lines.length === 1 ? inner : fold(lines.map((line, index) => (index === 0 ? line.replace(/[ \t]+$/u, "") : index === lines.length - 1 ? line.replace(/^[ \t]+/u, "") : line.trim())));
    if (raw[0] === "'") return folded.replaceAll("''", "'");
    try { return JSON.parse(`"${folded.replaceAll("\n", "\\n")}"`); } catch { return null; }
  }
  if (!joined) return "";
  // YAML keeps blank lines inside a plain value as line breaks, which joining by spaces would undercount.
  if (filled.length && rest.slice(0, rest.lastIndexOf(filled.at(-1))).some((line) => line.trim() === "")) return null;
  const parts = [head, ...filled.map((line) => line.trim())].filter(Boolean);
  if (parts.some((part, index) => (index > 0 && part.startsWith("#")) || (index < parts.length - 1 && /(?:^|\s)#/u.test(part)) || /:(?:\s|$)/u.test(part.replace(/\s+#.*$/u, "")))) return null;
  const plain = parts.map((part) => part.replace(/\s+#.*$/u, "")).join(" ").trim();
  return PLAIN_TEXT(plain) ? plain : null;
}

// The entry's frontmatter as hosts read it: its end offset, and the name and description they list the skill by.
export function readSkillFrontmatter(text, logicalSource, targetId) {
  if (!text.startsWith("---\n")) fail("ENTRY_INVALID", `${logicalSource} must start with YAML frontmatter.`, "Add a frontmatter block with name and description.");
  const end = text.indexOf("\n---\n", 4);
  if (end < 0) fail("ENTRY_INVALID", `${logicalSource} has no closing YAML frontmatter delimiter.`, "Close the frontmatter with --- on its own line.");
  const lines = text.slice(4, end).split("\n");
  const name = scalar(lines, "name");
  const description = scalar(lines, "description");
  if (name === null || description === null) fail("ENTRY_INVALID", `${logicalSource} has a name or description that is not a text value.`, "Write each once, after a colon and a space, as text: quoted ('...' or \"...\"), a | or > block, or plain words that start with a letter.");
  if (name !== targetId) fail("ENTRY_INVALID", `${logicalSource} frontmatter name is ${name === undefined ? "missing" : JSON.stringify(name)}, but its target is ${targetId}.`, `Set name: ${targetId}; hosts and installers name the skill by its frontmatter name and its folder, and the build names the folder by the targetId.`);
  if (name.length > NAME_LIMIT) fail("ENTRY_INVALID", `${logicalSource} name has ${name.length} characters; hosts accept at most ${NAME_LIMIT}.`, "Shorten the targetId and the frontmatter name together.");
  if (!description?.trim()) fail("ENTRY_INVALID", `${logicalSource} has no description in its frontmatter.`, "Add a description saying what the skill does and which requests should start it.");
  const characters = [...description.trim()].length;
  if (characters > DESCRIPTION_LIMIT) fail("ENTRY_INVALID", `${logicalSource} description has ${characters} characters; hosts accept at most ${DESCRIPTION_LIMIT}.`, "Shorten the description to what decides when the skill starts, and move the rest into the body.");
  return { end, name, description };
}
