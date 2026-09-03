import { lstat, readFile, realpath } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { copyTree, createDirectoryAtomic, exists, isInside, listFiles, readJson, writeJsonAtomic, writeTextAtomic } from "./io.mjs";
import { parseBody } from "../runtime/body.mjs";
import { hashFile, sha256 } from "../runtime/hash.mjs";
import { changedLocators, semanticDiff, snapshotContract } from "./semantic-diff.mjs";
import { mergeObligationLedger } from "./obligations.mjs";
import { INTENT_ARRAYS, selectProfile, validateIntent } from "./profiles.mjs";
import { assertSimpleProjectionOwnership, createEvalCases, writeSimplePackage } from "./generator.mjs";
import { lintSimpleSkill } from "./simple-lint.mjs";

const ARTIFACT_REGISTRY = Object.freeze({
  spec: Object.freeze({ profile: "p2", path: "spec.mjs", source: "behavior_source" }),
  collector: Object.freeze({ profile: "p2", path: "collectors/index.mjs", source: "observation_source" }),
  reference: Object.freeze({ profile: "p2", pathPolicy: isReferencePath, source: "context" })
});

export async function maintainPackage(skillRoot, change, options = {}) {
  const root = resolve(skillRoot);
  if (!await exists(join(root, "spec.mjs"))) return maintainSimplePackage(root, change);
  const originalFingerprint = await packageFingerprint(root);
  let report;
  await createDirectoryAtomic(root, async (stage) => {
    await copyTree(root, stage, { filter: (local) => ![".git", "node_modules"].includes(local.split("/")[0]), rejectUnsupportedEntries: true });
    if (await packageFingerprint(stage) !== originalFingerprint) throw new Error("Skill package changed while the maintenance snapshot was being staged; no update was installed.");
    const before = await snapshotContract(stage);
    const operations = await preflightOperations(stage, change.operations ?? []);
    await applyOperations(stage, operations);
    const after = await snapshotContract(stage);
    const artifactReceipts = operations.flatMap((operation) => operation.artifact ? [operation.artifact.receipt] : []);
    report = semanticDiff(before, after, { artifactReceipts });
    report.change_id = change.id ?? null;
    report.intent = change.intent ?? null;
    report.impact = impactSummary(report);
    report.impact.obligation_locators = await obligationImpact(stage, report.groups, artifactReceipts);
    await writeJsonAtomic(join(stage, ".skill-rails", "semantic-diff.json"), report);
    const { buildP2 } = await import("./build-core.mjs");
    await buildP2(stage, { allowGeneratedEdits: Boolean(options.repairGenerated), repeats: options.repeats ?? 200 });
    for (const operation of operations) if (operation.artifact && await hashFile(operation.artifact.target) !== operation.artifact.receipt.after_hash) throw new Error(`Build changed canonical artifact unexpectedly: ${operation.artifact.receipt.path}`);
  }, {
    replace: true,
    replaceNonEmpty: true,
    beforeInstall: async () => {
      if (options.beforeInstall) await options.beforeInstall();
      if (await packageFingerprint(root) !== originalFingerprint) throw new Error("Skill package changed while maintenance was running; no update was installed.");
    },
    verifyBackup: async ({ backup }) => {
      const capturedFingerprint = await packageFingerprint(backup);
      if (capturedFingerprint !== originalFingerprint) throw new Error(`Captured skill backup does not match the maintenance origin: expected ${originalFingerprint}, received ${capturedFingerprint}.`);
    }
  });
  return report;
}

export async function maintainSimplePackage(skillRoot, change) {
  const root = resolve(skillRoot);
  const validation = await lintSimpleSkill(root);
  if (!validation.ok) throw new Error(`SR_SIMPLE_INVALID: fix the current simple skill before maintenance:\n${validation.diagnostics.map((item) => `- ${item.code} ${item.pointer}: ${item.message}`).join("\n")}`);
  const operations = change.operations ?? [];
  if (!Array.isArray(operations) || operations.length === 0 || operations.some((operation) => operation.type !== "update-intent")) throw new Error("SR_SIMPLE_MAINTAIN_OPERATION: P0/P1 maintenance accepts one or more update-intent operations only.");
  if (operations.some((operation) => !operation.patch || Object.keys(operation.patch).length === 0)) throw new Error("SR_SIMPLE_MAINTAIN_OPERATION: update-intent requires a non-empty patch.");
  const [beforeIntent, beforeDecision] = await Promise.all([
    readJson(join(root, ".skill-rails", "intent.json")),
    readJson(join(root, ".skill-rails", "profile-decision.json"))
  ]);
  await assertSimpleProjectionOwnership(root, beforeIntent, beforeDecision.profile);
  const changedFields = [...new Set(operations.flatMap((operation) => Object.keys(operation.patch)))].sort();
  let report;
  await createDirectoryAtomic(root, async (stage) => {
    await copyTree(root, stage, { filter: (local) => ![".git", "node_modules"].includes(local.split("/")[0]) });
    for (const operation of operations) await updateIntent(stage, operation);
    const [intent, decision] = await Promise.all([
      readJson(join(stage, ".skill-rails", "intent.json")),
      readJson(join(stage, ".skill-rails", "profile-decision.json"))
    ]);
    const automatic = selectProfile(intent);
    if (!decision.explicit && automatic.profile !== decision.profile) throw new Error(`SR_PROFILE_CHANGE: updated intent selects ${automatic.profile}, but this package is ${decision.profile}; regenerate so the package shape changes explicitly.`);
    await writeJsonAtomic(join(stage, ".skill-rails", "profile-decision.json"), { ...decision, signals: automatic.signals });
    await writeJsonAtomic(join(stage, ".skill-rails", "eval-cases.json"), createEvalCases(intent));
    await writeSimplePackage(stage, intent, decision.profile, { refresh: true });
    const afterValidation = await lintSimpleSkill(stage);
    if (!afterValidation.ok) throw new Error(`SR_SIMPLE_MAINTAIN_INVALID: regenerated simple skill failed lint:\n${afterValidation.diagnostics.map((item) => `- ${item.code} ${item.pointer}: ${item.message}`).join("\n")}`);
    report = {
      schema: "skill-rails/simple-maintenance-report/1",
      change_id: change.id ?? null,
      intent: change.intent ?? null,
      profile: decision.profile,
      changed: sha256(beforeIntent) !== sha256(intent),
      changed_fields: changedFields,
      conditional_topics: intent.judgment_points.filter((item) => item && typeof item === "object").length
    };
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

async function preflightOperations(root, operations) {
  if (!Array.isArray(operations) || operations.length === 0) throw new Error("Maintenance change requires at least one operation.");
  const profile = (await readJson(join(root, ".skill-rails", "profile-decision.json"))).profile;
  const manifest = await readJson(join(root, ".generated.json"));
  const generatedPaths = new Set([".generated.json", ...Object.keys(manifest.generated_files ?? {}).map((path) => portableLexicalPath(path, "generated manifest path"))]);
  const prepared = [];
  const artifactTargets = new Map();
  for (const operation of operations) {
    const normalized = operation.type === "replace-spec"
      ? { type: "replace-artifact", kind: "spec", path: "spec.mjs", profile: "p2", expected_hash: operation.expected_hash, content: String(operation.source ?? ""), legacy_type: "replace-spec" }
      : operation;
    if (normalized.type === "replace-artifact") {
      const artifact = await preflightArtifact(root, normalized, profile, generatedPaths);
      const previous = artifactTargets.get(artifact.targetKey);
      if (previous) throw new Error(`replace-artifact may target each physical file only once per transaction: ${previous} and ${artifact.receipt.path}`);
      artifactTargets.set(artifact.targetKey, artifact.receipt.path);
      prepared.push({ ...normalized, artifact });
    } else if (["replace-body-section", "replace-resource", "update-intent"].includes(normalized.type)) prepared.push(normalized);
    else throw new Error(`Unsupported maintenance operation: ${normalized.type}`);
  }
  return prepared;
}

async function applyOperations(root, operations) {
  for (const operation of operations) {
    if (operation.type === "replace-artifact") await writeTextAtomic(operation.artifact.target, operation.artifact.content);
    else if (operation.type === "replace-body-section") await replaceBodySection(root, operation);
    else if (operation.type === "replace-resource") await replaceResource(root, operation);
    else if (operation.type === "update-intent") await updateIntent(root, operation);
  }
}

async function preflightArtifact(root, operation, packageProfile, generatedPaths) {
  const entry = ARTIFACT_REGISTRY[operation.kind];
  if (!entry) throw new Error(`replace-artifact has unsupported kind: ${operation.kind}`);
  if (operation.profile !== entry.profile || packageProfile !== entry.profile) throw new Error(`replace-artifact kind ${operation.kind} requires profile ${entry.profile}.`);
  const local = portableLexicalPath(operation.path, "replace-artifact path");
  if (generatedPaths.has(local)) throw new Error(`replace-artifact refuses generated path: ${local}`);
  if ((entry.path && local !== entry.path) || (entry.pathPolicy && !entry.pathPolicy(local))) throw new Error(`replace-artifact path is not registered for kind ${operation.kind}: ${local}`);
  const target = resolve(root, local);
  if (!isInside(root, target)) throw new Error(`replace-artifact path escapes the skill: ${local}`);
  const targetIdentity = await physicalTargetIdentity(root, local, target);
  const current = await readFile(target);
  const beforeHash = sha256(current);
  if (!/^sha256:[0-9a-f]{64}$/.test(operation.expected_hash ?? "") || operation.expected_hash !== beforeHash) {
    if (operation.legacy_type === "replace-spec") throw new Error("replace-spec requires the current expected_hash to prevent stale overwrite.");
    throw new Error(`replace-artifact requires the current expected_hash for ${local}.`);
  }
  if (typeof operation.content !== "string") throw new Error(`replace-artifact requires string content for ${local}.`);
  return {
    target,
    targetKey: targetIdentity.key,
    content: operation.content,
    receipt: { kind: operation.kind, path: local, before_hash: beforeHash, after_hash: sha256(Buffer.from(operation.content, "utf8")), source: entry.source }
  };
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

// The ledger says where each requirement landed; L16 only ever checks that the place still resolves.
// This reports which of those places this transaction disturbed, so the author sees the blast radius
// while making the edit. It asserts nothing about whether the requirement is still satisfied there:
// that judgment stays with the author, and a report is not an approval. Ordering is by code unit, not
// by locale, because the receipt is a committed artifact and must not depend on the host it was made on.
async function obligationImpact(root, groups, artifactReceipts) {
  const locators = changedLocators(groups, artifactReceipts);
  if (locators.size === 0) return [];
  const path = join(root, ".skill-rails", "obligation-ledger.json");
  let ledger;
  try { ledger = JSON.parse(await readFile(path, "utf8")); }
  catch (error) {
    if (error.code === "ENOENT") return [];
    throw new Error(`Obligation ledger cannot be read for the maintenance receipt: ${path}: ${error.message}`);
  }
  const affected = new Map();
  for (const atom of ledger.atoms ?? []) {
    if (atom.disposition !== "projected") continue;
    const channels = new Map();
    for (const [channel, list] of [["target", atom.targets ?? []], ["evidence", atom.evidence ?? []]]) {
      for (const locator of list) if (locators.has(locator)) channels.set(locator, [...new Set([...(channels.get(locator) ?? []), channel])]);
    }
    for (const [locator, kinds] of channels) {
      if (!affected.has(locator)) affected.set(locator, []);
      affected.get(locator).push({ id: atom.id, channel: kinds.sort().join("+") });
    }
  }
  return [...affected.entries()]
    .sort(([a], [b]) => compareCodeUnits(a, b))
    .map(([locator, atoms]) => ({ locator, change: locators.get(locator), atom_count: atoms.length, atoms: atoms.sort((a, b) => compareCodeUnits(a.id, b.id)) }));
}

function compareCodeUnits(a, b) { return a < b ? -1 : a > b ? 1 : 0; }

function impactSummary(report) {
  const counts = {};
  for (const [group, changes] of Object.entries(report.groups)) if (changes.length > 0) counts[group] = { total: changes.length, added: changes.filter((item) => item.change === "added").length, removed: changes.filter((item) => item.change === "removed").length, modified: changes.filter((item) => item.change === "modified").length };
  return counts;
}

function isReferencePath(local) {
  return /^references\/[a-zA-Z0-9._/-]+$/.test(local) && !local.split("/").includes("..");
}

async function packageFingerprint(root) {
  const files = await listFiles(root, { exclude: [".git", "node_modules"], rejectUnsupportedEntries: true });
  const entries = await Promise.all(files.map(async (path) => `${relative(root, path).replace(/\\/g, "/")}:${await hashFile(path)}`));
  return sha256(entries);
}

function portableLexicalPath(value, label) {
  if (typeof value !== "string" || value.length === 0 || value.includes("\\") || value.startsWith("/") || /^[a-zA-Z]:/.test(value)) throw new Error(`${label} must be one portable package-relative path.`);
  const segments = value.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..") || segments.join("/") !== value) throw new Error(`${label} must use one canonical portable spelling without empty or dot segments: ${value}`);
  return value;
}

async function physicalTargetIdentity(root, local, target) {
  let cursor = root;
  const segments = local.split("/");
  for (let index = 0; index < segments.length; index += 1) {
    cursor = join(cursor, segments[index]);
    let entry;
    try { entry = await lstat(cursor); }
    catch (error) {
      if (error?.code === "ENOENT") throw new Error(`replace-artifact first slice requires an existing target: ${local}`, { cause: error });
      throw error;
    }
    if (entry.isSymbolicLink()) throw new Error(`replace-artifact refuses symbolic link or junction path: ${local}`);
    const final = index === segments.length - 1;
    if ((!final && !entry.isDirectory()) || (final && !entry.isFile())) throw new Error(`replace-artifact requires a regular-file target: ${local}`);
  }
  const [physicalRoot, physicalTarget] = await Promise.all([realpath(root), realpath(target)]);
  if (!isInside(physicalRoot, physicalTarget)) throw new Error(`replace-artifact physical path escapes the skill: ${local}`);
  const physicalLocal = relative(physicalRoot, physicalTarget).replace(/\\/g, "/");
  if (physicalLocal !== local) throw new Error(`replace-artifact path does not use the target's canonical physical spelling: ${local}; expected ${physicalLocal}`);
  return { key: process.platform === "win32" ? physicalTarget.toLowerCase() : physicalTarget };
}
