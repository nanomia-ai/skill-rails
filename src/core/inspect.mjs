import { relative } from "node:path";
import { compareCodePoint } from "./canonicalize.mjs";
import { fail } from "./errors.mjs";

function targetArtifacts(target) {
  const rows = [{ targetId: target.target.targetId, path: "SKILL.md" }];
  for (const id of target.target.imports) rows.push({ targetId: target.target.targetId, path: `references/${id}.md` });
  return rows;
}

function moduleView(graph, id) {
  const module = graph.modules.get(id);
  const consumers = [...graph.targets.values()].filter((item) => item.target.imports.includes(id) || item.target.fallbackModule === id);
  return {
    focus: { kind: "module", id, path: module.path },
    imports: [],
    consumers: consumers.map((item) => item.target.targetId).sort(compareCodePoint),
    artifacts: consumers.map((item) => ({ targetId: item.target.targetId, path: item.target.fallbackModule === id && !item.target.imports.includes(id) ? "references/fallback.md" : `references/${id}.md` })),
    mechanisms: { observer: null, renderer: null, contract: null },
    declaredInputs: [], declaredOutput: null,
  };
}

function targetView(item) {
  const target = item.target;
  return {
    focus: { kind: "target", id: target.targetId, path: item.path },
    imports: [...target.imports],
    consumers: [],
    artifacts: targetArtifacts(item),
    mechanisms: {
      observer: item.files.get("observer")?.path ?? null,
      renderer: item.files.get("renderer")?.path ?? null,
      contract: item.files.get("answerContract")?.path ?? null,
    },
    declaredInputs: target.declaredInputs ?? [], declaredOutput: target.declaredOutput ?? null,
  };
}

export function inspectGraph(graph, query) {
  let view;
  if (query.id) {
    if (query.id === graph.manifest.packageId) view = { focus: { kind: "package", id: query.id, path: relative(graph.rootReal, graph.manifestPath).replaceAll("\\", "/") }, imports: [], consumers: [...graph.targets.keys()].sort(compareCodePoint), artifacts: [], mechanisms: { observer: null, renderer: null, contract: null }, declaredInputs: [], declaredOutput: null };
    else if (graph.modules.has(query.id)) view = moduleView(graph, query.id);
    else if (graph.targets.has(query.id)) view = targetView(graph.targets.get(query.id));
  } else if (query.path) {
    const exact = query.path;
    const module = [...graph.modules.entries()].find(([, item]) => item.path === exact);
    const target = [...graph.targets.values()].find((item) => item.path === exact || [...item.files.values()].some((file) => file.path === exact));
    if (module) view = moduleView(graph, module[0]);
    else if (target) view = targetView(target);
    else if (relative(graph.rootReal, graph.manifestPath).replaceAll("\\", "/") === exact) view = { focus: { kind: "package", id: graph.manifest.packageId, path: exact }, imports: [], consumers: [...graph.targets.keys()].sort(compareCodePoint), artifacts: [], mechanisms: { observer: null, renderer: null, contract: null }, declaredInputs: [], declaredOutput: null };
  }
  if (!view) fail("INSPECT_NOT_FOUND", "No canonical source node matches the exact query.", "Use an exact package/module/target ID or referenced relative path.");
  return {
    schemaVersion: 1,
    sourceGraphSha256: graph.sourceGraphSha256,
    ...view,
    owner: { kind: "domain-package", path: relative(graph.rootReal, graph.manifestPath).replaceAll("\\", "/") },
    checks: [],
    externalBoundaries: [],
    gaps: ["requirement/check/external-boundary semantic edges are not declared in v1"],
    truncated: false,
  };
}
