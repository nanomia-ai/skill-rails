import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { exists } from "./io.mjs";
import { parseSkillMarkdown } from "./frontmatter.mjs";
import { profileSignals, selectProfile, validateIntent } from "./profiles.mjs";
import { createObligationLedger } from "./obligations.mjs";
import { sha256 } from "../runtime/hash.mjs";
import { inventoryFlatMarkdown, readUtf8RegularInside, resolveRegularInside } from "./regular-paths.mjs";
import {
  GUIDANCE_ENTRY_MARKER, GUIDANCE_INDEX_PATH, GUIDANCE_TOPIC_MARKER, guidanceTopicPath, judgmentTopics, parseGuidanceIndex
} from "./guidance.mjs";

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
  await validateLinks(root, skillPath, parsed.body, diagnostics);
  const adapterPath = join(root, "agents", "openai.yaml");
  if (await exists(adapterPath)) {
    const adapter = await readFile(adapterPath, "utf8");
    for (const key of ["interface:", "display_name:", "short_description:", "default_prompt:", "policy:", "allow_implicit_invocation:"]) if (!adapter.includes(key)) diagnostics.push(diag("SR_OPENAI_ADAPTER", "agents/openai.yaml", `Missing adapter field: ${key}`));
  }

  const authoring = await validateSimpleAuthoringState(root, diagnostics);
  await validateProgressiveGuidance(root, parsed.body, authoring.intent, diagnostics);

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

async function validateSimpleAuthoringState(root, diagnostics) {
  const locals = {
    intent: ".skill-rails/intent.json",
    ledger: ".skill-rails/obligation-ledger.json",
    decision: ".skill-rails/profile-decision.json",
    cases: ".skill-rails/eval-cases.json"
  };
  const presence = Object.fromEntries(await Promise.all(Object.entries(locals).map(async ([key, local]) => [key, await exists(join(root, ...local.split("/")))])));
  if (Object.values(presence).every((value) => !value)) return { intent: null, profile: null };
  if (Object.values(presence).some((value) => !value)) {
    diagnostics.push(diag("SR_LEDGER_STATE", ".skill-rails", "Intent-backed skills require intent.json, obligation-ledger.json, profile-decision.json, and eval-cases.json."));
    return { intent: null, profile: null };
  }
  const intent = await readJsonDiagnostic(root, locals.intent, diagnostics, "SR_INTENT_JSON");
  const ledger = await readJsonDiagnostic(root, locals.ledger, diagnostics, "SR_LEDGER_JSON");
  const decision = await readJsonDiagnostic(root, locals.decision, diagnostics, "SR_PROFILE_DECISION");
  const evalCases = await readJsonDiagnostic(root, locals.cases, diagnostics, "SR_EVAL_CASES");
  if (!intent || !ledger) return { intent, profile: ledger?.profile ?? null };
  const intentIssues = validateIntent(intent);
  for (const issue of intentIssues) diagnostics.push(diag("SR_INTENT", ".skill-rails/intent.json", issue));
  const profile = ledger.profile;
  if (!new Set(["p0", "p1"]).has(profile)) diagnostics.push(diag("SR_LEDGER_PROFILE", ".skill-rails/obligation-ledger.json:profile", "A simple skill ledger profile must be p0 or p1."));
  if (!decision || decision.schema !== "skill-rails/profile-decision/1" || !new Set(["p0", "p1"]).has(decision.profile) || typeof decision.explicit !== "boolean" || !Array.isArray(decision.signals)) {
    diagnostics.push(diag("SR_PROFILE_DECISION", ".skill-rails/profile-decision.json", "Profile decision must use schema profile-decision/1 with a simple profile, explicit flag, and signals array."));
  } else {
    if (decision.profile !== profile) diagnostics.push(diag("SR_PROFILE_DECISION", ".skill-rails/profile-decision.json:profile", "Profile decision must agree with the obligation ledger."));
    const expectedSignals = intentIssues.length === 0 ? profileSignals(intent) : null;
    if (expectedSignals && JSON.stringify(decision.signals) !== JSON.stringify(expectedSignals)) diagnostics.push(diag("SR_PROFILE_DECISION", ".skill-rails/profile-decision.json:signals", "Profile decision signals are stale relative to intent.json."));
    if (expectedSignals && !decision.explicit && selectProfile(intent).profile !== decision.profile) diagnostics.push(diag("SR_PROFILE_DECISION", ".skill-rails/profile-decision.json:profile", "Automatic profile decision is stale relative to intent.json."));
  }
  if (!Array.isArray(evalCases)) diagnostics.push(diag("SR_EVAL_CASES", ".skill-rails/eval-cases.json", "Evaluation cases must be an array."));
  if (!["skill-rails/obligation-ledger/1", "skill-rails/obligation-ledger/2"].includes(ledger.schema)) diagnostics.push(diag("SR_LEDGER_SCHEMA", ".skill-rails/obligation-ledger.json:schema", "Simple skill obligation ledger schema is invalid."));
  if (ledger.schema === "skill-rails/obligation-ledger/1" && judgmentTopics(intent).length > 0) diagnostics.push(diag("SR_LEDGER_SCHEMA", ".skill-rails/obligation-ledger.json:schema", "Conditional guidance requires obligation-ledger/2."));
  if (ledger.intent_hash !== sha256(intent)) diagnostics.push(diag("SR_LEDGER_STALE", ".skill-rails/obligation-ledger.json:intent_hash", "Obligation ledger is stale relative to intent.json."));
  if (!Array.isArray(ledger.atoms)) {
    diagnostics.push(diag("SR_LEDGER_ATOMS", ".skill-rails/obligation-ledger.json:atoms", "Obligation ledger atoms must be an array."));
    return { intent, profile };
  }
  if (intentIssues.length === 0 && new Set(["p0", "p1"]).has(profile)) {
    const skillSource = (await readUtf8RegularInside(root, "SKILL.md")).text;
    const expected = createObligationLedger(intent, profile);
    const expectedAtoms = new Map(expected.atoms.map((atom) => [atom.id, atom]));
    const actualAtoms = new Map();
    for (const atom of ledger.atoms) {
      if (!atom?.id || actualAtoms.has(atom.id)) diagnostics.push(diag("SR_LEDGER_ID", `.skill-rails/obligation-ledger.json:${atom?.id ?? "<missing>"}`, "Obligation atom id is missing or duplicated."));
      else actualAtoms.set(atom.id, atom);
    }
    for (const [id, expectedAtom] of expectedAtoms) {
      const actual = actualAtoms.get(id);
      if (!actual || actual.source !== expectedAtom.source || actual.text !== expectedAtom.text) diagnostics.push(diag("SR_LEDGER_COVERAGE", `.skill-rails/obligation-ledger.json:${id}`, "Intent atom is missing or no longer preserves its source text."));
      else if (actual.disposition === "obsolete" || actual.disposition === "duplicate" || (expectedAtom.disposition === "projected" && actual.disposition !== "projected")) diagnostics.push(diag("SR_LEDGER_DISPOSITION", `.skill-rails/obligation-ledger.json:${id}`, "A live simple-skill intent atom cannot be retired or demoted from its required projection."));
    }
    for (const id of actualAtoms.keys()) if (!expectedAtoms.has(id) && String(actualAtoms.get(id)?.source).startsWith("intent.")) diagnostics.push(diag("SR_LEDGER_COVERAGE", `.skill-rails/obligation-ledger.json:${id}`, "Ledger contains a stale intent atom."));
    for (const atom of ledger.atoms) await validateSimpleAtom(root, atom, Array.isArray(evalCases) ? evalCases : [], diagnostics, skillSource);
  }
  if (profile === "p1") {
    try { await readUtf8RegularInside(root, "scripts/run.mjs"); }
    catch (error) { diagnostics.push(diag("SR_P1_HELPER", "scripts/run.mjs", error.message)); }
  }
  return { intent, profile };
}

async function validateSimpleAtom(root, atom, evalCases, diagnostics, skillSource) {
  const pointer = `.skill-rails/obligation-ledger.json:${atom?.id ?? "<missing>"}`;
  const source = String(atom?.source ?? "");
  const text = String(atom?.text ?? "").trim();
  const universalIntent = isUniversalSimpleIntentSource(source);
  if (!new Set(["projected", "review-required", "obsolete", "duplicate"]).has(atom?.disposition)) {
    diagnostics.push(diag("SR_LEDGER_DISPOSITION", pointer, "Obligation atom has an unknown disposition."));
    return;
  }
  if (universalIntent && text && !skillSource.includes(text)) {
    diagnostics.push(diag("SR_LEDGER_TEXT", pointer, "Universal simple-skill intent must remain visible in the always-loaded SKILL.md."));
  }
  if (atom.disposition === "review-required") return;
  if (atom.disposition !== "projected") return;
  if (!Array.isArray(atom.targets) || atom.targets.length === 0 || !Array.isArray(atom.evidence) || atom.evidence.length === 0) {
    diagnostics.push(diag("SR_LEDGER_LOCATOR", pointer, "Projected obligations require target and evidence locators."));
    return;
  }
  const targetContents = [];
  for (const locator of [...atom.targets, ...atom.evidence]) {
    const resolved = await resolveSimpleLocator(root, locator, evalCases);
    if (!resolved.exists) diagnostics.push(diag("SR_LEDGER_LOCATOR", pointer, `Obligation locator does not resolve: ${locator}`));
    if (atom.targets.includes(locator) && resolved.content !== null) targetContents.push(resolved);
  }
  if (!universalIntent && source.startsWith("intent.") && text && targetContents.length > 0 && !targetContents.some((target) => targetPreservesAtom(target, atom))) diagnostics.push(diag("SR_LEDGER_TEXT", pointer, "No owning target preserves the obligation text."));
}

function isUniversalSimpleIntentSource(source) {
  return source.startsWith("intent.")
    && source !== "intent.description"
    && !/^intent\.judgment_points\[\d+\]\.(?:when|points\[\d+\])$/.test(source);
}

async function resolveSimpleLocator(root, locator, evalCases) {
  if (typeof locator !== "string") return { exists: false, content: null, local: null };
  if (locator.startsWith("eval:")) return { exists: evalCases.some((item) => item.id === locator.slice(5)), content: null, local: null };
  if (!locator.startsWith("file:")) return { exists: false, content: null, local: null };
  const local = locator.slice(5).replace(/\\/g, "/");
  try {
    const loaded = await readUtf8RegularInside(root, local);
    return { exists: true, content: loaded.text, local };
  } catch { return { exists: false, content: null, local }; }
}

function targetPreservesAtom(target, atom) {
  const text = String(atom.text ?? "").trim();
  if (atom.source === "intent.description" && target.local === "SKILL.md") return parseSkillMarkdown(target.content).frontmatter?.description === normalizedScalar(text);
  if (/^intent\.judgment_points\[\d+\]\.when$/.test(String(atom.source)) && target.local === GUIDANCE_INDEX_PATH) {
    try { return parseGuidanceIndex(target.content).some((row) => row.when === text); }
    catch { return false; }
  }
  return target.content.includes(text);
}

function normalizedScalar(value) { return String(value).replace(/\r?\n/g, " ").trim(); }

async function validateProgressiveGuidance(root, skillBody, intent, diagnostics) {
  const indexPath = join(root, ...GUIDANCE_INDEX_PATH.split("/"));
  const hasIndex = await exists(indexPath);
  const hasEntry = skillBody.includes(GUIDANCE_ENTRY_MARKER);
  const topics = intent && validateIntent(intent).length === 0 ? judgmentTopics(intent) : [];
  const inventory = await inventoryFlatMarkdown(root, "references/guidance");
  for (const issue of inventory.issues) diagnostics.push(diag(issue.message.includes("nested directories") ? "SR_GUIDANCE_ORPHAN" : "SR_GUIDANCE_PATH", issue.path, issue.message));
  if (!hasIndex && !hasEntry && topics.length === 0 && !inventory.exists) return;
  if (!hasIndex) diagnostics.push(diag("SR_GUIDANCE_INDEX", GUIDANCE_INDEX_PATH, "Progressive guidance entry requires its index."));
  if (!hasEntry) diagnostics.push(diag("SR_GUIDANCE_ENTRY", "SKILL.md", "Guidance index requires the progressive entry marker."));
  const entryLinks = markdownLinks(skillBody).map(normalizeEntryLink);
  if (!entryLinks.includes(GUIDANCE_INDEX_PATH)) diagnostics.push(diag("SR_GUIDANCE_ENTRY", "SKILL.md", "Progressive entry must link to the guidance index."));
  if (!hasIndex) return;
  let source;
  try { source = (await readUtf8RegularInside(root, GUIDANCE_INDEX_PATH)).text; }
  catch (error) { diagnostics.push(diag("SR_GUIDANCE_PATH", GUIDANCE_INDEX_PATH, error.message)); return; }
  let rows;
  try { rows = parseGuidanceIndex(source); }
  catch (error) { diagnostics.push(diag("SR_GUIDANCE_INDEX", GUIDANCE_INDEX_PATH, error.message)); return; }
  const ids = new Set();
  const indexedFiles = new Set();
  for (const row of rows) {
    if (ids.has(row.id)) diagnostics.push(diag("SR_GUIDANCE_ID", `${GUIDANCE_INDEX_PATH}:${row.id}`, "Guidance topic id is duplicated."));
    ids.add(row.id);
    if (row.id !== row.pathId) diagnostics.push(diag("SR_GUIDANCE_PATH", `${GUIDANCE_INDEX_PATH}:${row.id}`, "Guidance file name must match its stable id."));
    indexedFiles.add(`${row.pathId}.md`);
    const local = `references/${row.path}`;
    try {
      const loaded = await readUtf8RegularInside(root, local);
      const topicSource = loaded.text;
      if (!topicSource.includes(GUIDANCE_TOPIC_MARKER)) diagnostics.push(diag("SR_GUIDANCE_TOPIC", relative(root, loaded.path), "Guidance topic marker is missing."));
      await validateLinks(root, loaded.path, topicSource, diagnostics);
    } catch (error) { diagnostics.push(diag("SR_GUIDANCE_LINK", `${GUIDANCE_INDEX_PATH}:${row.path}`, error.message)); }
  }
  for (const entry of inventory.files) if (!indexedFiles.has(entry.name)) diagnostics.push(diag("SR_GUIDANCE_ORPHAN", entry.local, "Guidance Markdown must be indexed or removed."));
  if (topics.length > 0) {
    const rowById = new Map(rows.map((row) => [row.id, row]));
    for (const topic of topics) {
      const row = rowById.get(topic.id);
      if (!row || row.when !== topic.when.trim() || row.path !== `guidance/${topic.id}.md`) diagnostics.push(diag("SR_GUIDANCE_INTENT", `${GUIDANCE_INDEX_PATH}:${topic.id}`, "Guidance routing no longer matches intent.json."));
      const topicPath = join(root, ...guidanceTopicPath(topic.id).split("/"));
      if (await exists(topicPath)) {
        try {
          const topicSource = (await readUtf8RegularInside(root, guidanceTopicPath(topic.id))).text;
          for (const point of topic.points) if (!topicSource.includes(point.trim())) diagnostics.push(diag("SR_GUIDANCE_INTENT", guidanceTopicPath(topic.id), "Guidance topic no longer preserves every intent point."));
        } catch (error) { diagnostics.push(diag("SR_GUIDANCE_PATH", guidanceTopicPath(topic.id), error.message)); }
      }
      for (const text of [topic.when, ...topic.points]) if (text.trim() && containsStandaloneText(skillBody, text)) diagnostics.push(diag("SR_GUIDANCE_DUPLICATE", "SKILL.md", `Conditional topic ${topic.id} is duplicated in the always-loaded entry.`));
    }
    for (const row of rows) if (!topics.some((topic) => topic.id === row.id)) diagnostics.push(diag("SR_GUIDANCE_INTENT", `${GUIDANCE_INDEX_PATH}:${row.id}`, "Guidance index contains a topic absent from intent.json."));
  } else if (intent) for (const row of rows) diagnostics.push(diag("SR_GUIDANCE_INTENT", `${GUIDANCE_INDEX_PATH}:${row.id}`, "Guidance index contains a topic absent from intent.json."));
  await validateLinks(root, indexPath, source, diagnostics);
}

async function validateLinks(root, sourcePath, source, diagnostics) {
  for (const link of markdownLinks(source)) {
    const path = resolve(dirname(sourcePath), ...link.replace(/\\/g, "/").split("/"));
    const local = relative(root, path).replace(/\\/g, "/");
    try { await resolveRegularInside(root, local, "file"); }
    catch { diagnostics.push(diag("SR_SKILL_LINK", `${relative(root, sourcePath)}:${link}`, "Linked local resource does not exist, is non-regular, or escapes the skill.")); }
  }
}

async function readJsonDiagnostic(root, local, diagnostics, code) {
  try { return JSON.parse((await readUtf8RegularInside(root, local)).text); }
  catch (error) { diagnostics.push(diag(code, local, error.message)); return null; }
}

function markdownLinks(text) {
  return [...text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1]).filter((value) => !/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(value) && !value.includes("<"));
}
function normalizeEntryLink(value) { return String(value).replace(/^\.\//, "").replace(/\\/g, "/"); }
function containsStandaloneText(document, value) {
  const source = String(document).replace(/\r\n/g, "\n");
  const text = String(value).trim().replace(/\r\n/g, "\n");
  return source.split("\n").some((line) => line.trim() === text || line.trim() === `- ${text}`)
    || source.split(/\n\s*\n/).some((block) => block.trim() === text);
}
function result(diagnostics) { return { ok: diagnostics.length === 0, level: "skill", diagnostics }; }
function diag(code, pointer, message, hint = null) { return { code, pointer, message, hint, level: "error" }; }
