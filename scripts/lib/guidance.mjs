export const GUIDANCE_ENTRY_MARKER = "<!-- skill-rails:progressive-guidance/v1 -->";
export const GUIDANCE_INDEX_MARKER = "<!-- skill-rails:guidance-index/v1 -->";
export const GUIDANCE_TOPIC_MARKER = "<!-- skill-rails:guidance-topic/v1 -->";
export const GUIDANCE_INDEX_PATH = "references/guidance-index.md";

export function isJudgmentTopic(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function judgmentTopics(intent) {
  return (intent?.judgment_points ?? []).filter(isJudgmentTopic);
}

export function inlineJudgmentPoints(intent) {
  return (intent?.judgment_points ?? []).filter((item) => typeof item === "string");
}

export function guidanceTopicPath(id) {
  return `references/guidance/${id}.md`;
}

export function renderGuidanceEntry() {
  return `## Conditional guidance

${GUIDANCE_ENTRY_MARKER}
Before beginning the task, read the [guidance index](${GUIDANCE_INDEX_PATH}). Follow its routing instructions and open only the topic files that match the current request. Do not scan the guidance directory. If the index or a matched topic is unavailable, stop and report the missing path.`;
}

export function renderGuidanceIndex(topics) {
  const rows = topics.map((topic) => `| \`${topic.id}\` | ${escapeTableCell(topic.when.trim())} | [read](guidance/${topic.id}.md) |`);
  return `# Guidance index

${GUIDANCE_INDEX_MARKER}
Match the current request and context against each **Read when** condition. Read every matching topic and no unrelated topic. If a condition may apply and the uncertainty matters to the result, read that topic. If no row matches, continue without loading topic guidance.

| ID | Read when | Guidance |
| --- | --- | --- |
${rows.join("\n")}
`;
}

export function renderGuidanceTopic(topic) {
  return `# ${title(topic.id)}

${GUIDANCE_TOPIC_MARKER}
${topic.points.map((point) => point.trim()).join("\n\n")}
`;
}

export function parseGuidanceIndex(source) {
  const normalized = String(source).replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const markerAt = lines.indexOf(GUIDANCE_INDEX_MARKER);
  const headerAt = lines.indexOf("| ID | Read when | Guidance |");
  if (markerAt < 0) throw new Error(`Missing ${GUIDANCE_INDEX_MARKER}`);
  if (headerAt < 0 || lines[headerAt + 1] !== "| --- | --- | --- |") throw new Error("Guidance index must use the canonical three-column table.");
  if (markerAt > headerAt || lines.filter((line) => line === GUIDANCE_INDEX_MARKER).length !== 1) throw new Error("Guidance index marker must appear exactly once before the table.");
  const rows = [];
  let index = headerAt + 2;
  for (; index < lines.length && lines[index].trim() !== ""; index += 1) {
    const match = lines[index].match(/^\| `([a-z0-9]+(?:-[a-z0-9]+)*)` \| ((?:\\[\\|]|[^|\r\n])+) \| \[read\]\(guidance\/([a-z0-9]+(?:-[a-z0-9]+)*)\.md\) \|$/);
    if (!match) throw new Error(`Invalid guidance row: ${lines[index]}`);
    rows.push({ id: match[1], when: unescapeTableCell(match[2].trim()), path: `guidance/${match[3]}.md`, pathId: match[3] });
  }
  if (rows.length === 0) throw new Error("Guidance index requires at least one topic row.");
  if (lines.slice(index).some((line) => line.trim() !== "")) throw new Error("Guidance index cannot contain trailing prose or a second routing table.");
  return rows;
}

function title(name) {
  return String(name).split("-").map((part) => part ? part[0].toUpperCase() + part.slice(1) : part).join(" ");
}

function escapeTableCell(value) { return String(value).replaceAll("\\", "\\\\").replaceAll("|", "\\|"); }
function unescapeTableCell(value) { return String(value).replace(/\\([\\|])/g, "$1"); }
