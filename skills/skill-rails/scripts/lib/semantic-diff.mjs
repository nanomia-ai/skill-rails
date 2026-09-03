import { readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { listFiles } from "./io.mjs";
import { validateFast, importVerifiedSource } from "../runtime/validator.mjs";
import { sha256 } from "../runtime/hash.mjs";
import { loadBody } from "../runtime/body.mjs";
import { resolveTemplate } from "../runtime/templates.mjs";

export async function snapshotContract(skillRoot) {
  const root = resolve(skillRoot);
  const fast = await validateFast(root);
  if (!fast.ok) throw new Error(`Cannot snapshot invalid spec: ${fast.diagnostics.map((item) => item.message).join("; ")}`);
  const spec = await importVerifiedSource(fast);
  const bodyDocument = await loadBody(root);
  const templateContent = {};
  for (const [id, declaration] of Object.entries(spec.TEMPLATES ?? {})) templateContent[id] = sha256(await resolveTemplate(root, id, declaration, bodyDocument.markdown));
  // Hash every maintainable resource, not only READ_FIRST paths: `replace-resource` may change any
  // file under these roots, and a receipt that omits them reports a real change as any_changed:false.
  const references = {};
  for (const dir of ["references", "templates"]) {
    let files = [];
    try { files = await listFiles(join(root, dir)); }
    catch (error) { if (error?.code !== "ENOENT") throw error; }
    for (const file of files.sort()) references[relative(root, file).replace(/\\/g, "/")] = sha256(await readFile(file, "utf8"));
  }
  return {
    spec_hash: sha256(fast.source),
    observations: objectIndex(spec.OBSERVATIONS, (value) => value),
    guards: index(spec.GUARDS, summarizeGuard), stages: index(spec.STAGES, summarizeStage),
    tables: objectIndex(spec.TABLES, summarizeTable), formats: objectIndex(spec.FORMATS, summarizeFormat),
    templates: objectIndex(spec.TEMPLATES, (value) => value), template_content: templateContent,
    body: Object.fromEntries(bodyDocument.sections.map((section) => [section.ref, section.hash])), references,
    ownership: objectIndex(spec.OWNERSHIP, (value) => value), artifacts: objectIndex(spec.ARTIFACTS, (value) => value),
    roles: objectIndex(spec.ROLES, (value) => value), declarations: objectIndex(spec.DECLARATIONS, (value) => value), deferred: index(spec.DEFERRED, (value) => value)
  };
}

export function semanticDiff(before, after, options = {}) {
  const groups = {};
  for (const key of ["observations", "guards", "stages", "tables", "formats", "templates", "template_content", "body", "references", "ownership", "artifacts", "roles", "declarations", "deferred"]) groups[key] = diffIndex(before[key], after[key]);
  const artifactReceipts = options.artifactReceipts ?? [];
  const changedArtifacts = artifactReceipts.filter((item) => item.before_hash !== item.after_hash);
  const sourceChanges = {
    behavior_source: before.spec_hash !== after.spec_hash || changedArtifacts.some((item) => item.source === "behavior_source"),
    observation_source: changedArtifacts.some((item) => item.source === "observation_source"),
    context: changedArtifacts.some((item) => item.source === "context") || ["body", "templates", "template_content", "references"].some((key) => groups[key].length > 0)
  };
  return {
    schema: "skill-rails/semantic-diff/1",
    spec_hash: { before: before.spec_hash, after: after.spec_hash },
    changed: before.spec_hash !== after.spec_hash,
    any_changed: Object.values(sourceChanges).some(Boolean) || Object.values(groups).some((changes) => changes.length > 0),
    source_changes: sourceChanges,
    artifact_receipts: artifactReceipts,
    groups
  };
}

// An obligation ledger names where a requirement landed with `body:<ref>`, `file:<path>` and
// `spec:<GROUP>/<id>`, so the places a transaction disturbed are a mapping over the groups the snapshot
// already indexes, not a new source of truth. Three groups need care. A table is indexed whole but cited
// per row, so a changed table expands to every row state on either side: over-reporting a sibling row is
// honest, while an exact match on the table alone would report nothing at all. A template is cited by id
// whether its declaration or its resolved content moved. `ROLES` is left out because the shipped resolver
// treats it as an array and cannot resolve a role locator at all; mapping to it would advertise support
// that does not exist. `fixture:` and `eval:` are absent because no maintenance operation reaches them.
const LOCATOR_SPEC_GROUP = Object.freeze({
  observations: "OBSERVATIONS", formats: "FORMATS", templates: "TEMPLATES", artifacts: "ARTIFACTS",
  declarations: "DECLARATIONS", guards: "GUARDS", stages: "STAGES", deferred: "DEFERRED"
});

export function changedLocators(groups = {}, artifactReceipts = []) {
  const locators = new Map();
  const note = (locator, change) => {
    if (!locators.has(locator)) locators.set(locator, change);
    else if (locators.get(locator) !== change) locators.set(locator, "modified");
  };
  for (const [group, changes] of Object.entries(groups)) {
    for (const item of changes ?? []) {
      if (group === "body") note(`body:${item.id}`, item.change);
      else if (group === "references") note(`file:${item.id}`, item.change);
      else if (group === "template_content") note(`spec:TEMPLATES/${item.id}`, item.change);
      else if (group === "tables") for (const state of tableRowStates(item)) note(`spec:TABLES/${item.id}/${state}`, item.change);
      else if (LOCATOR_SPEC_GROUP[group]) note(`spec:${LOCATOR_SPEC_GROUP[group]}/${item.id}`, item.change);
    }
  }
  // A registered whole-file replacement is a real change to a place an obligation can name, and the
  // snapshot has no group for a collector, so the receipt is the only record that it moved.
  for (const receipt of artifactReceipts) if (receipt?.path && receipt.before_hash !== receipt.after_hash) note(`file:${receipt.path}`, "modified");
  return locators;
}

function tableRowStates(item) {
  const rows = [...(item.before?.rows ?? []), ...(item.after?.rows ?? [])];
  return [...new Set(rows.map((row) => row.state).filter((state) => typeof state === "string"))].sort();
}

function index(items = [], project) { return Object.fromEntries(items.map((item, index) => [item.id ?? `index-${index}`, project(item)])); }
function objectIndex(value = {}, project) { return Object.fromEntries(Object.entries(value).map(([id, item]) => [id, project(item)])); }
function summarizeGuard(value) { return { reads: value.reads, then: value.then, forbids: value.forbids ?? [], body: value.body, unless: value.unless?.id ?? null }; }
function summarizeStage(value) { return { reads: value.reads, needs: value.needs ?? [], table: value.table ?? null, branches: Object.keys(value.branches ?? {}), effects: effects(value.effects), effect_plans: effectPlans(value), body: value.body, record: value.record ?? null, reentry: value.reentry ?? null }; }
function summarizeTable(value) { return { exclusive: value.exclusive, rows: (value.rows ?? []).map((row) => ({ state: row.state, reads: row.reads })) }; }
function summarizeFormat(value) { return { kind: value.kind, head: value.head, fields: value.fields }; }
function effects(plan) { return (plan ?? []).map((item) => Array.isArray(item) ? item[0] : item); }
function effectPlans(stage) {
  return {
    default: Array.isArray(stage.effects) ? canonicalValue(stage.effects) : null,
    branches: Object.fromEntries(Object.entries(stage.branches ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([id, plan]) => [id, canonicalValue(plan)]))
  };
}
function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]));
  return value;
}
function diffIndex(before = {}, after = {}) {
  const ids = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return ids.flatMap((id) => {
    if (!(id in before)) return [{ id, change: "added", after: after[id] }];
    if (!(id in after)) return [{ id, change: "removed", before: before[id] }];
    if (JSON.stringify(before[id]) !== JSON.stringify(after[id])) return [{ id, change: "modified", before: before[id], after: after[id] }];
    return [];
  });
}
