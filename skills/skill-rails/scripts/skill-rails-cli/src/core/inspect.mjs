import { relative } from "node:path";
import { compareCodePoint } from "./canonicalize.mjs";
import { fileArtifactPath, toolArtifactPath } from "./build.mjs";
import { fail } from "./errors.mjs";

const NO_RECORD = { renderer: null, contract: null, declaredInputs: [], declaredOutput: null };

function targetArtifacts(graph, item) {
  const targetId = item.target.targetId;
  const rows = [{ targetId, path: "SKILL.md" }];
  for (const id of item.target.imports) rows.push({ targetId, path: `references/${id}.md` });
  for (const name of item.referenceNames) rows.push({ targetId, path: `references/${name}` });
  for (const id of item.target.tools ?? []) {
    const tool = graph.tools.get(id);
    for (const file of tool.files) rows.push({ targetId, path: toolArtifactPath(tool, file) });
  }
  for (const entry of item.delivered) for (const file of entry.files) rows.push({ targetId, path: fileArtifactPath(entry, file) });
  return rows;
}

function recordView(item) {
  const { record } = item.target;
  if (!record) return NO_RECORD;
  return {
    renderer: item.files.get("renderer").path,
    contract: item.files.get("answerContract").path,
    declaredInputs: [...record.declaredInputs],
    declaredOutput: record.declaredOutput,
  };
}

function packageView(graph, path) {
  return { focus: { kind: "package", id: graph.manifest.packageId, path }, imports: [], tools: [], consumers: [...graph.targets.keys()].sort(compareCodePoint), artifacts: [], record: NO_RECORD };
}

function moduleView(graph, id) {
  const module = graph.modules.get(id);
  const consumers = [...graph.targets.values()].filter((item) => item.target.imports.includes(id));
  return {
    focus: { kind: "module", id, path: module.path },
    imports: [],
    tools: [],
    consumers: consumers.map((item) => item.target.targetId).sort(compareCodePoint),
    artifacts: consumers.map((item) => ({ targetId: item.target.targetId, path: `references/${id}.md` })),
    record: NO_RECORD,
  };
}

function toolView(graph, id) {
  const tool = graph.tools.get(id);
  const consumers = [...graph.targets.values()].filter((item) => (item.target.tools ?? []).includes(id));
  return {
    focus: { kind: "tool", id, path: tool.path },
    imports: [],
    tools: [],
    consumers: consumers.map((item) => item.target.targetId).sort(compareCodePoint),
    artifacts: consumers.flatMap((item) => tool.files.map((file) => ({ targetId: item.target.targetId, path: toolArtifactPath(tool, file) }))),
    record: NO_RECORD,
  };
}

// A declared file may be delivered by several targets; its view lists every one so a change rebuilds them all.
function fileView(graph, path) {
  const rows = [...graph.targets.values()].flatMap((item) => item.delivered
    .filter((entry) => entry.path === path || entry.files.some((file) => file.path === path))
    .flatMap((entry) => entry.files.filter((file) => entry.path === path || file.path === path).map((file) => ({ targetId: item.target.targetId, path: fileArtifactPath(entry, file) }))));
  if (rows.length === 0) return undefined;
  return {
    focus: { kind: "file", id: null, path },
    imports: [],
    tools: [],
    consumers: [...new Set(rows.map((row) => row.targetId))].sort(compareCodePoint),
    artifacts: rows,
    record: NO_RECORD,
  };
}

function targetView(graph, item) {
  return {
    focus: { kind: "target", id: item.target.targetId, path: item.path },
    imports: [...item.target.imports],
    tools: [...(item.target.tools ?? [])],
    consumers: [],
    artifacts: targetArtifacts(graph, item),
    record: recordView(item),
  };
}

export function inspectGraph(graph, query) {
  const manifestPath = relative(graph.rootReal, graph.manifestPath).replaceAll("\\", "/");
  let view;
  if (query.id) {
    const kinds = [query.id === graph.manifest.packageId, graph.modules.has(query.id), graph.tools.has(query.id), graph.targets.has(query.id)].filter(Boolean).length;
    if (kinds > 1) fail("INSPECT_AMBIGUOUS", `${query.id} names more than one kind of source node.`, "Query the exact source path with --path instead.");
    if (query.id === graph.manifest.packageId) view = packageView(graph, manifestPath);
    else if (graph.modules.has(query.id)) view = moduleView(graph, query.id);
    else if (graph.tools.has(query.id)) view = toolView(graph, query.id);
    else if (graph.targets.has(query.id)) view = targetView(graph, graph.targets.get(query.id));
  } else if (query.path) {
    const exact = query.path;
    const module = [...graph.modules.entries()].find(([, item]) => item.path === exact);
    const tool = [...graph.tools.values()].find((item) => item.path === exact || item.files.some((file) => file.path === exact));
    const target = [...graph.targets.values()].find((item) => item.path === exact || [...item.files.values()].some((file) => file.path === exact));
    const file = module || tool || target ? undefined : fileView(graph, exact);
    if (module) view = moduleView(graph, module[0]);
    else if (tool) view = toolView(graph, tool.id);
    else if (target) view = targetView(graph, target);
    else if (file) view = file;
    else if (manifestPath === exact) view = packageView(graph, exact);
  }
  if (!view) fail("INSPECT_NOT_FOUND", "No canonical source node matches the exact query.", "Use an exact package/module/tool/target ID or referenced relative path.");
  return {
    schemaVersion: 2,
    sourceGraphSha256: graph.sourceGraphSha256,
    ...view,
    owner: { kind: "domain-package", path: manifestPath },
    checks: [],
    externalBoundaries: [],
    gaps: ["requirement/check/external-boundary semantic edges are not declared"],
    truncated: false,
  };
}
