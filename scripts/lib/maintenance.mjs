import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { copyTree, createDirectoryAtomic, isInside, readJson, writeJsonAtomic, writeTextAtomic } from "./io.mjs";
import { parseBody } from "../runtime/body.mjs";
import { sha256 } from "../runtime/hash.mjs";
import { semanticDiff, snapshotContract } from "./semantic-diff.mjs";
import { mergeObligationLedger } from "./obligations.mjs";
import { INTENT_ARRAYS, validateIntent } from "./profiles.mjs";

export async function maintainPackage(skillRoot, change, options = {}) {
  const root = resolve(skillRoot);
  const before = await snapshotContract(root);
  let report;
  await createDirectoryAtomic(root, async (stage) => {
    await copyTree(root, stage, { filter: (local) => !local.startsWith(".git/") && !local.startsWith("node_modules/") });
    await applyOperations(stage, change.operations ?? []);
    const after = await snapshotContract(stage);
    report = semanticDiff(before, after);
    report.change_id = change.id ?? null;
    report.intent = change.intent ?? null;
    report.impact = impactSummary(report);
    await writeJsonAtomic(join(stage, ".skill-rails", "semantic-diff.json"), report);
    const { buildP2 } = await import("./build-core.mjs");
    await buildP2(stage, { allowGeneratedEdits: Boolean(options.repairGenerated), repeats: options.repeats ?? 200 });
  }, { replace: true, replaceNonEmpty: true });
  return report;
}

export function diagnoseContract(snapshot, query = null) {
  const matches = [];
  for (const [group, entries] of Object.entries(snapshot)) {
    if (!entries || typeof entries !== "object" || Array.isArray(entries) || group === "spec_hash") continue;
    for (const [id, value] of Object.entries(entries)) if (!query || id.includes(query) || JSON.stringify(value).includes(query)) matches.push({ group, id, value });
  }
  return { schema: "skill-rails/impact-query/1", query, matches };
}

async function applyOperations(root, operations) {
  if (!Array.isArray(operations) || operations.length === 0) throw new Error("Maintenance change requires at least one operation.");
  for (const operation of operations) {
    if (operation.type === "replace-body-section") await replaceBodySection(root, operation);
    else if (operation.type === "replace-resource") await replaceResource(root, operation);
    else if (operation.type === "replace-spec") await replaceSpec(root, operation);
    else if (operation.type === "update-intent") await updateIntent(root, operation);
    else throw new Error(`Unsupported maintenance operation: ${operation.type}`);
  }
}

async function replaceBodySection(root, operation) {
  const path = join(root, operation.language === "ko" ? "body_ko.md" : "body.md");
  const source = await readFile(path, "utf8");
  const parsed = parseBody(source, path);
  const section = parsed.sections.find((item) => item.ref === operation.id);
  if (!section) throw new Error(`Body section does not exist: ${operation.id}`);
  const heading = `## ${operation.id}`;
  const replacement = `${heading}\n\n${String(operation.content ?? "").trim()}\n\n`;
  await writeTextAtomic(path, source.slice(0, section.start) + replacement + source.slice(section.end).replace(/^\s*/, ""));
}

async function replaceResource(root, operation) {
  const local = String(operation.path ?? "").replace(/\\/g, "/");
  if (!/^(?:references|templates)\/[a-zA-Z0-9._/-]+$/.test(local) || local.split("/").includes("..")) throw new Error(`Resource path is outside the maintainable roots: ${local}`);
  const target = resolve(root, local);
  if (!isInside(root, target)) throw new Error(`Resource path escapes the skill: ${local}`);
  await writeTextAtomic(target, String(operation.content ?? ""));
}

async function replaceSpec(root, operation) {
  const path = join(root, "spec.mjs");
  const current = await readFile(path, "utf8");
  if (!operation.expected_hash || operation.expected_hash !== sha256(current)) throw new Error("replace-spec requires the current expected_hash to prevent stale overwrite.");
  await writeTextAtomic(path, String(operation.source ?? ""));
}

async function updateIntent(root, operation) {
  const path = join(root, ".skill-rails", "intent.json");
  const intent = await readJson(path);
  const allowed = new Set(["description", "problem", ...INTENT_ARRAYS]);
  const changed = Object.keys(operation.patch ?? {});
  for (const [key, value] of Object.entries(operation.patch ?? {})) {
    if (!allowed.has(key)) throw new Error(`Intent field cannot be changed by update-intent: ${key}`);
    intent[key] = value;
  }
  const issues = validateIntent(intent);
  if (issues.length > 0) throw new Error(`Updated intent is invalid:\n- ${issues.join("\n- ")}`);
  await writeJsonAtomic(path, intent);
  const profile = (await readJson(join(root, ".skill-rails", "profile-decision.json"))).profile;
  const ledgerPath = join(root, ".skill-rails", "obligation-ledger.json");
  const ledger = await readJson(ledgerPath);
  await writeJsonAtomic(ledgerPath, mergeObligationLedger(ledger, intent, profile, changed));
}

function impactSummary(report) {
  const counts = {};
  for (const [group, changes] of Object.entries(report.groups)) if (changes.length > 0) counts[group] = { total: changes.length, added: changes.filter((item) => item.change === "added").length, removed: changes.filter((item) => item.change === "removed").length, modified: changes.filter((item) => item.change === "modified").length };
  return counts;
}
