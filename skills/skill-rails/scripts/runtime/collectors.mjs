import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { hashFile } from "./hash.mjs";
import { UNKNOWN, isUnknown, unknown } from "./dsl.mjs";
import { validateDomainValue } from "./domains.mjs";
import { fail } from "./diagnostics.mjs";

export async function loadCollectorRegistry(skillRoot) {
  const path = join(resolve(skillRoot), "collectors", "index.mjs");
  try { await access(path, fsConstants.R_OK); }
  catch { return { collectors: {}, snapshotBasis: null, path: null }; }
  const url = pathToFileURL(path);
  url.searchParams.set("skill_rails_collectors", (await hashFile(path)).slice(7));
  const module = await import(url.href);
  const extra = Object.keys(module).filter((name) => !["collectors", "snapshotBasis"].includes(name));
  if (extra.length > 0) fail("SR_COLLECTORS", `Collector module has unsupported exports: ${extra.join(", ")}.`, { pointer: path });
  if (!module.collectors || typeof module.collectors !== "object") fail("SR_COLLECTORS", "collectors/index.mjs must export a collectors object.", { pointer: path });
  for (const [name, collector] of Object.entries(module.collectors)) if (typeof collector !== "function" || collector.length > 1) fail("SR_COLLECTORS", `Collector ${name} must be a function accepting at most one ctx argument.`, { pointer: path });
  if (module.snapshotBasis !== undefined && module.snapshotBasis !== null && typeof module.snapshotBasis !== "function") fail("SR_COLLECTORS", "snapshotBasis must be a function or null.", { pointer: path });
  return { collectors: module.collectors, snapshotBasis: module.snapshotBasis ?? null, path };
}

export async function collectObservations(spec, registry, context, supplied = {}) {
  const flat = {};
  const unknowns = [];
  for (const [field, declaration] of Object.entries(spec.OBSERVATIONS ?? {})) {
    let value;
    if (declaration.judged || declaration.decided) value = supplied[field] ?? unknown(`missing-${declaration.judged ? "judged" : "decided"}`, field);
    else {
      const collector = registry.collectors[declaration.collector];
      if (!collector) fail("L2", `Collector is not registered: ${declaration.collector}`, { pointer: `OBSERVATIONS.${field}` });
      try { value = await collector(context); }
      catch (error) { value = unknown("collector-error", { field, message: error.message }); }
    }
    if (value === "UNKNOWN") value = UNKNOWN;
    const validation = validateDomainValue(declaration.domain, value);
    if (!validation.ok) fail("L3", `Collector or input returned a value outside ${field}'s domain.`, { pointer: `OBSERVATIONS.${field}`, details: { value } });
    if (isUnknown(value)) unknowns.push({ field, reason: value.reason, details: value.details ?? null });
    flat[field] = value;
  }
  return { flat, nested: nestFlat(flat), unknowns };
}

export function normalizeFixtureObservations(spec, input) {
  const flattened = hasDottedKeys(input) ? input : flattenNested(input);
  const flat = {};
  const unknowns = [];
  for (const [field, declaration] of Object.entries(spec.OBSERVATIONS ?? {})) {
    let value = Object.hasOwn(flattened, field) ? flattened[field] : unknown("fixture-missing", field);
    if (value === "UNKNOWN") value = UNKNOWN;
    const validation = validateDomainValue(declaration.domain, value);
    if (!validation.ok) fail("L3", `Fixture value is outside ${field}'s domain.`, { pointer: `fixture.s.${field}`, details: { value } });
    if (isUnknown(value)) unknowns.push({ field, reason: value.reason, details: value.details ?? null });
    flat[field] = value;
  }
  return { flat, nested: nestFlat(flat), unknowns };
}

export function nestFlat(flat) {
  const root = {};
  for (const [path, value] of Object.entries(flat)) {
    const segments = path.split(".");
    let current = root;
    for (const segment of segments.slice(0, -1)) current = current[segment] ??= {};
    current[segments.at(-1)] = value;
  }
  return root;
}

export function flattenNested(value, prefix = "", output = {}) {
  for (const [key, item] of Object.entries(value ?? {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (item && typeof item === "object" && !Array.isArray(item) && !isUnknown(item)) flattenNested(item, path, output);
    else output[path] = item;
  }
  return output;
}

function hasDottedKeys(value) { return Object.keys(value ?? {}).some((key) => key.includes(".")); }
