import { access, readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { join, resolve } from "node:path";
import { sha256 } from "./hash.mjs";
import { resolveInside } from "./path-policy.mjs";

const DISPOSITIONS = new Set(["projected", "review-required", "obsolete", "duplicate"]);

export async function validateAuthoringLedger(skillRoot, spec, body, fixtures) {
  const root = resolve(skillRoot);
  let intent;
  try { intent = JSON.parse(await readFile(join(root, ".skill-rails", "intent.json"), "utf8")); }
  catch (error) { return error.code === "ENOENT" ? [] : [diag(".skill-rails/intent.json", `Intent evidence is unreadable: ${error.message}`)]; }
  let ledger;
  try { ledger = JSON.parse(await readFile(join(root, ".skill-rails", "obligation-ledger.json"), "utf8")); }
  catch (error) { return [diag(".skill-rails/obligation-ledger.json", `Intent-backed P2 requires a readable obligation ledger: ${error.message}`)]; }

  const diagnostics = [];
  if (ledger.schema !== "skill-rails/obligation-ledger/1") diagnostics.push(diag(".skill-rails/obligation-ledger.json:schema", "Obligation ledger schema is invalid."));
  if (ledger.intent_hash !== sha256(intent)) diagnostics.push(diag(".skill-rails/obligation-ledger.json:intent_hash", "Obligation ledger is stale relative to intent.json."));
  if (!Array.isArray(ledger.atoms)) return [...diagnostics, diag(".skill-rails/obligation-ledger.json:atoms", "Obligation ledger atoms must be an array.")];
  const ids = new Set();
  const releaseReady = (spec.DEFERRED ?? []).length === 0;
  const evalCases = await optionalArray(join(root, ".skill-rails", "eval-cases.json"));
  for (const atom of ledger.atoms) {
    const pointer = `.skill-rails/obligation-ledger.json:${atom?.id ?? "<missing>"}`;
    if (!atom?.id || ids.has(atom.id)) diagnostics.push(diag(pointer, "Obligation atom id is missing or duplicated."));
    ids.add(atom?.id);
    if (!atom?.source || typeof atom.text !== "string" || !DISPOSITIONS.has(atom.disposition)) diagnostics.push(diag(pointer, "Obligation atom requires source, text, and a known disposition."));
    if (releaseReady && atom.disposition === "review-required") diagnostics.push(diag(pointer, "DEFERRED is empty but an authoring obligation remains review-required."));
    if (atom.disposition === "projected") {
      if (!Array.isArray(atom.targets) || atom.targets.length === 0 || !Array.isArray(atom.evidence) || atom.evidence.length === 0) diagnostics.push(diag(pointer, "Projected obligations require target and evidence locators."));
      for (const locator of [...(atom.targets ?? []), ...(atom.evidence ?? [])]) if (!await locatorExists(locator, { root, spec, body, fixtures, evalCases })) diagnostics.push(diag(pointer, `Obligation locator does not resolve: ${locator}`));
    }
  }
  return diagnostics;
}

async function locatorExists(locator, context) {
  if (typeof locator !== "string") return false;
  if (locator.startsWith("file:")) {
    try { await access(await resolveInside(context.root, locator.slice(5), { code: "L16" }), fsConstants.R_OK); return true; }
    catch { return false; }
  }
  if (locator.startsWith("body:")) return context.body?.sections.some((item) => item.ref === locator.slice(5)) ?? false;
  if (locator.startsWith("fixture:")) return context.fixtures.some((item) => item.id === locator.slice(8));
  if (locator.startsWith("eval:")) return context.evalCases.some((item) => item.id === locator.slice(5));
  if (locator.startsWith("spec:")) return specLocatorExists(context.spec, locator.slice(5));
  return false;
}

function specLocatorExists(spec, path) {
  const [group, first, second] = path.split("/");
  if (["GUARDS", "STAGES", "ROLES", "DEFERRED"].includes(group)) return (spec[group] ?? []).some((item) => item.id === first);
  if (group === "TABLES") return Boolean(spec.TABLES?.[first]?.rows?.some((item) => item.state === second));
  if (["OBSERVATIONS", "FORMATS", "TEMPLATES", "ARTIFACTS", "DECLARATIONS"].includes(group)) return Object.hasOwn(spec[group] ?? {}, first);
  return false;
}

async function optionalArray(path) {
  try { const value = JSON.parse(await readFile(path, "utf8")); return Array.isArray(value) ? value : []; }
  catch { return []; }
}

function diag(pointer, message) { return { code: "L16", pointer, message, hint: null, level: "error" }; }
