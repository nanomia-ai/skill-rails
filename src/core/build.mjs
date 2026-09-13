import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, relative, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { canonicalJson, compareCodePoint, sha256, treeSha256 } from "./canonicalize.mjs";
import { fail } from "./errors.mjs";
import { assertArtifactIntegrity } from "./check.mjs";

const COMMON_RUNTIME_ARTIFACTS = new Map([
  ["scripts/runtime/common.mjs", "src/runtime/common.mjs"],
  ["scripts/runtime/integrity.mjs", "src/runtime/integrity.mjs"],
]);

function withGeneratedMarker(entry, logicalSource) {
  const marker = `<!-- generated; do not edit; source: ${logicalSource}; receipt: .skill-rails-build.json -->`;
  if (!entry.startsWith("---\n")) fail("ENTRY_INVALID", `${logicalSource} must start with YAML frontmatter.`, "Add a closed skill frontmatter block.");
  const end = entry.indexOf("\n---\n", 4);
  if (end < 0) fail("ENTRY_INVALID", `${logicalSource} has no closing YAML frontmatter delimiter.`, "Close the frontmatter with --- on its own line.");
  return `${entry.slice(0, end + 5)}${marker}\n${entry.slice(end + 5)}`;
}

function artifactPathForModule(id) {
  return `references/${id}.md`;
}

function generatedTargetConfig(graph, item) {
  const { target } = item;
  return {
    schemaVersion: 1,
    packageId: graph.manifest.packageId,
    packageVersion: graph.manifest.packageVersion,
    targetId: target.targetId,
    mode: target.mode,
    imports: target.imports.map((id) => ({ id, path: artifactPathForModule(id) })),
    fallbackReference: target.fallbackModule ? "references/fallback.md" : null,
    domainConfig: target.mode === "prose" ? null : "config/domain.json",
    domainConfigSchema: target.mode === "prose" ? null : "config/domain.schema.json",
    packet: target.packet ? "config/packet.json" : null,
    observer: target.observer ? "scripts/domain/observer.mjs" : null,
    renderer: target.renderer ? "scripts/domain/renderer.mjs" : null,
    answerContract: target.mode === "prose" ? null : `contracts/${basename(target.answerContract)}`,
    declaredInputs: target.declaredInputs ?? [],
    declaredOutput: target.declaredOutput ?? null,
    outputMode: target.outputMode ?? null,
    regionBootstrap: target.regionBootstrap ?? null,
  };
}

function addSource(sources, id, item) {
  sources.push({ id, path: item.path, sha256: sha256(item.bytes) });
}

export async function planTargetBuild(graph, targetId) {
  const item = graph.targets.get(targetId);
  if (!item) fail("TARGET_NOT_FOUND", `Unknown targetId: ${targetId}`, "Choose an exact targetId declared by the source package.");
  const artifacts = new Map();
  const sources = [];
  addSource(sources, "source-package", { path: relative(graph.rootReal, graph.manifestPath).replaceAll("\\", "/"), bytes: graph.manifestBytes });
  addSource(sources, `target:${targetId}`, { path: item.path, bytes: item.bytes });
  const entry = item.files.get("entry");
  addSource(sources, "entry", entry);
  artifacts.set("SKILL.md", Buffer.from(withGeneratedMarker(entry.text, entry.path), "utf8"));

  for (const id of item.target.imports) {
    const module = graph.modules.get(id);
    addSource(sources, `module:${id}`, module);
    artifacts.set(artifactPathForModule(id), module.bytes);
  }
  if (item.target.fallbackModule) {
    const module = graph.modules.get(item.target.fallbackModule);
    if (!sources.some((source) => source.id === `module:${module.id}`)) addSource(sources, `module:${module.id}`, module);
    artifacts.set("references/fallback.md", module.bytes);
  }

  artifacts.set("config/target.json", Buffer.from(`${canonicalJson(generatedTargetConfig(graph, item))}\n`, "utf8"));
  if (item.target.mode !== "prose") {
    const mappings = [
      ["domainConfig", "config/domain.json"],
      ["domainConfigSchema", "config/domain.schema.json"],
      ...(item.target.packet ? [["packet", "config/packet.json"]] : []),
      ["renderer", "scripts/domain/renderer.mjs"],
      ["answerContract", `contracts/${basename(item.target.answerContract)}`],
    ];
    if (item.target.observer) mappings.push(["observer", "scripts/domain/observer.mjs"]);
    for (const [role, destination] of mappings) {
      const source = item.files.get(role);
      addSource(sources, role, source);
      artifacts.set(destination, source.bytes);
    }
  }

  const runtimeArtifacts = new Map(COMMON_RUNTIME_ARTIFACTS);
  runtimeArtifacts.set("scripts/run.mjs", item.target.mode === "prose" ? "src/runtime/run-check.mjs" : "src/runtime/run.mjs");
  if (item.target.mode === "prepare-record") {
    runtimeArtifacts.set("scripts/runtime/prepare.mjs", "src/runtime/prepare.mjs");
  }
  if (item.target.mode !== "prose") runtimeArtifacts.set("scripts/runtime/record.mjs", "src/runtime/record.mjs");
  for (const [destination, source] of runtimeArtifacts) {
    const bytes = await readFile(resolve(graph.repositoryRoot, source));
    artifacts.set(destination, bytes);
    addSource(sources, `runtime:${destination}`, { path: source, bytes });
  }
  const contractNames = ["build-receipt.schema.json"];
  if (item.target.packet) contractNames.push("packet-kernel.schema.json", "observed-facts.schema.json", "prepared-work.schema.json");
  for (const name of contractNames) {
    const sourcePath = `contracts/${name}`;
    const bytes = await readFile(resolve(graph.repositoryRoot, sourcePath));
    artifacts.set(sourcePath, bytes);
    addSource(sources, `contract:${name}`, { path: sourcePath, bytes });
  }

  const artifactRows = [...artifacts.entries()]
    .sort(([left], [right]) => compareCodePoint(left, right))
    .map(([path, bytes]) => ({ path, sha256: sha256(bytes) }));
  const receipt = {
    schemaVersion: 1,
    coreVersion: graph.coreVersion,
    packageId: graph.manifest.packageId,
    packageVersion: graph.manifest.packageVersion,
    targetId,
    sources: sources.sort((a, b) => compareCodePoint(a.path, b.path) || compareCodePoint(a.id, b.id)),
    artifacts: artifactRows,
    imports: [...item.target.imports],
    treeSha256: treeSha256(artifacts),
  };
  return { graph, item, artifacts, receipt, receiptBytes: Buffer.from(`${canonicalJson(receipt)}\n`, "utf8") };
}

async function exists(path) {
  try { await stat(path); return true; } catch (error) { if (error?.code === "ENOENT") return false; throw error; }
}

async function materialize(plan, destination) {
  const exact = resolve(destination);
  const parent = dirname(exact);
  await mkdir(parent, { recursive: true });
  if (await exists(exact)) {
    await assertArtifactIntegrity(exact, "GENERATED_ARTIFACT_MODIFIED");
  }
  const token = randomUUID();
  const stage = resolve(parent, `.${basename(exact)}.stage-${token}`);
  const backup = resolve(parent, `.${basename(exact)}.backup-${token}`);
  try {
    await mkdir(stage);
    for (const [path, bytes] of [...plan.artifacts.entries()].sort(([a], [b]) => compareCodePoint(a, b))) {
      const output = resolve(stage, ...path.split("/"));
      await mkdir(dirname(output), { recursive: true });
      await writeFile(output, bytes);
    }
    await writeFile(resolve(stage, ".skill-rails-build.json"), plan.receiptBytes);
    await assertArtifactIntegrity(stage);
    if (await exists(exact)) await rename(exact, backup);
    try {
      await rename(stage, exact);
    } catch (error) {
      if (await exists(backup)) await rename(backup, exact);
      throw error;
    }
    await rm(backup, { recursive: true, force: true });
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
  return { targetId: plan.receipt.targetId, output: exact, treeSha256: plan.receipt.treeSha256 };
}

export async function buildTargets(graph, options) {
  const selected = options.target ? [options.target] : [...graph.targets.keys()].sort(compareCodePoint);
  if (options.target && !options.out) fail("ARGUMENT_INVALID", "--target requires --out.", "Provide one exact target output directory.");
  if (!options.target && !options.outRoot) fail("ARGUMENT_INVALID", "Building all targets requires --out-root.", "Provide the distribution root.");
  const plans = [];
  for (const targetId of selected) plans.push(await planTargetBuild(graph, targetId));
  const outputs = [];
  for (const plan of plans) {
    const destination = options.target ? options.out : resolve(options.outRoot, "skills", plan.receipt.targetId);
    outputs.push(await materialize(plan, destination));
  }
  return { schemaVersion: 1, status: "BUILT", outputs };
}
