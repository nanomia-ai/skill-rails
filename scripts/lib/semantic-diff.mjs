import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateFast, importVerifiedSource } from "../runtime/validator.mjs";
import { sha256 } from "../runtime/hash.mjs";
import { loadBody } from "../runtime/body.mjs";
import { resolveTemplate } from "../runtime/templates.mjs";
import { resolveInside } from "../runtime/path-policy.mjs";

export async function snapshotContract(skillRoot) {
  const root = resolve(skillRoot);
  const fast = await validateFast(root);
  if (!fast.ok) throw new Error(`Cannot snapshot invalid spec: ${fast.diagnostics.map((item) => item.message).join("; ")}`);
  const spec = await importVerifiedSource(fast);
  const bodyDocument = await loadBody(root);
  const templateContent = {};
  for (const [id, declaration] of Object.entries(spec.TEMPLATES ?? {})) templateContent[id] = sha256(await resolveTemplate(root, id, declaration, bodyDocument.markdown));
  const references = {};
  for (const item of spec.READ_FIRST ?? []) if (item.path) references[item.path] = sha256(await readFile(await resolveInside(root, item.path, { code: "L7" }), "utf8"));
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

export function semanticDiff(before, after) {
  const groups = {};
  for (const key of ["observations", "guards", "stages", "tables", "formats", "templates", "template_content", "body", "references", "ownership", "artifacts", "roles", "declarations", "deferred"]) groups[key] = diffIndex(before[key], after[key]);
  return { schema: "skill-rails/semantic-diff/1", spec_hash: { before: before.spec_hash, after: after.spec_hash }, changed: before.spec_hash !== after.spec_hash, groups };
}

function index(items = [], project) { return Object.fromEntries(items.map((item, index) => [item.id ?? `index-${index}`, project(item)])); }
function objectIndex(value = {}, project) { return Object.fromEntries(Object.entries(value).map(([id, item]) => [id, project(item)])); }
function summarizeGuard(value) { return { reads: value.reads, then: value.then, forbids: value.forbids ?? [], body: value.body, unless: value.unless?.id ?? null }; }
function summarizeStage(value) { return { reads: value.reads, needs: value.needs ?? [], table: value.table ?? null, branches: Object.keys(value.branches ?? {}), effects: effects(value.effects), body: value.body, record: value.record ?? null, reentry: value.reentry ?? null }; }
function summarizeTable(value) { return { exclusive: value.exclusive, rows: (value.rows ?? []).map((row) => ({ state: row.state, reads: row.reads })) }; }
function summarizeFormat(value) { return { kind: value.kind, head: value.head, fields: value.fields }; }
function effects(plan) { return (plan ?? []).map((item) => Array.isArray(item) ? item[0] : item); }
function diffIndex(before = {}, after = {}) {
  const ids = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return ids.flatMap((id) => {
    if (!(id in before)) return [{ id, change: "added", after: after[id] }];
    if (!(id in after)) return [{ id, change: "removed", before: before[id] }];
    if (JSON.stringify(before[id]) !== JSON.stringify(after[id])) return [{ id, change: "modified", before: before[id], after: after[id] }];
    return [];
  });
}
