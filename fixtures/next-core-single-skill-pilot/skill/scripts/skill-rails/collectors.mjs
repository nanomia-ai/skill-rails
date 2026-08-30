import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { hashFile } from "./hash.mjs";
import { unknown } from "./dsl.mjs";
import { fail } from "./diagnostics.mjs";
import { normalizeObservationSet } from "./observations.mjs";

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
  const raw = {};
  for (const [field, declaration] of Object.entries(spec.OBSERVATIONS ?? {})) {
    let value;
    if (declaration.judged || declaration.decided) value = Object.hasOwn(supplied, field) ? supplied[field] : unknown(`missing-${declaration.judged ? "judged" : "decided"}`, field);
    else {
      const collector = registry.collectors[declaration.collector];
      if (!collector) fail("L2", `Collector is not registered: ${declaration.collector}`, { pointer: `OBSERVATIONS.${field}` });
      try { value = await collector(context); }
      catch (error) { value = unknown("collector-error", { field, message: error.message }); }
    }
    raw[field] = value;
  }
  return normalizeObservationSet(spec, raw, { missingReason: "observation-missing", pointerPrefix: "OBSERVATIONS", valueLabel: "Collector or input value" });
}
