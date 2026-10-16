import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, relative, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { canonicalJson, compareCodePoint, sha256, treeSha256 } from "./canonicalize.mjs";
import { fail } from "./errors.mjs";
import { assertArtifactIntegrity } from "./check.mjs";
import { buildHeadingIndex } from "./heading-index.mjs";
import { assertNoCaseFoldCollisions } from "./paths.mjs";

// The record tool's runtime closure: present only in targets that declare `record`.
const RECORD_RUNTIME_ARTIFACTS = Object.freeze([
  ["scripts/run.mjs", "src/runtime/run-record.mjs"],
  ["scripts/runtime/common.mjs", "src/runtime/common.mjs"],
  ["scripts/runtime/integrity.mjs", "src/runtime/integrity.mjs"],
  ["scripts/runtime/exchange.mjs", "src/runtime/exchange.mjs"],
  ["scripts/runtime/initialize-record.mjs", "src/runtime/initialize-record.mjs"],
  ["scripts/runtime/record.mjs", "src/runtime/record.mjs"],
  ["contracts/record-exchange.schema.json", "contracts/record-exchange.schema.json"],
]);

const AUTHORING_CLI_ROOT = "scripts/skill-rails-cli";
const AUTHORING_CLI_SOURCES = Object.freeze([
  "contracts/build-receipt.schema.json",
  "contracts/record-exchange.schema.json",
  "contracts/source-package.schema.json",
  "contracts/target.schema.json",
  "package.json",
  "src/core/build.mjs",
  "src/core/canonicalize.mjs",
  "src/core/check.mjs",
  "src/core/cli.mjs",
  "src/core/errors.mjs",
  "src/core/heading-index.mjs",
  "src/core/human-overview.mjs",
  "src/core/inspect.mjs",
  "src/core/paths.mjs",
  "src/core/validate.mjs",
  "src/runtime/common.mjs",
  "src/runtime/exchange.mjs",
  "src/runtime/initialize-record.mjs",
  "src/runtime/integrity.mjs",
  "src/runtime/record.mjs",
  "src/runtime/run-record.mjs",
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

export function toolArtifactPath(tool, file) {
  return tool.kind === "file" ? `scripts/${tool.id}${extname(tool.path)}` : `scripts/${tool.id}/${file.relative}`;
}

// Only the fields the record runtime reads; the source descriptor stays the owner of their meaning.
function recordRuntimeConfig(item) {
  const { record } = item.target;
  return {
    schemaVersion: 2,
    targetId: item.target.targetId,
    domainConfig: "config/domain.json",
    renderer: "scripts/domain/renderer.mjs",
    answerContract: `contracts/${basename(record.answerContract)}`,
    declaredInputs: [...record.declaredInputs],
    declaredOutput: record.declaredOutput,
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
  const put = (path, bytes, owner) => {
    if (artifacts.has(path)) fail("ARTIFACT_COLLISION", `${targetId} would generate ${path} twice (${owner}).`, "Rename the tool or its file so its delivered path differs from every other artifact.");
    artifacts.set(path, bytes);
  };
  addSource(sources, "source-package", { path: relative(graph.rootReal, graph.manifestPath).replaceAll("\\", "/"), bytes: graph.manifestBytes });
  addSource(sources, `target:${targetId}`, { path: item.path, bytes: item.bytes });
  const entry = item.files.get("entry");
  addSource(sources, "entry", entry);
  put("SKILL.md", Buffer.from(withGeneratedMarker(entry.text, entry.path), "utf8"), "entry");

  for (const id of item.target.imports) {
    const module = graph.modules.get(id);
    addSource(sources, `module:${id}`, module);
    put(artifactPathForModule(id), module.bytes, `module ${id}`);
  }
  for (const [role, file] of item.files) {
    if (!role.startsWith("reference:")) continue;
    addSource(sources, role, file);
    put(`references/${role.slice("reference:".length)}`, file.bytes, role);
  }
  if (item.target.headingIndex) {
    const module = graph.modules.get(item.target.headingIndex);
    put(`references/${item.target.headingIndex}.index.json`, buildHeadingIndex(module), "heading index");
  }
  for (const id of item.target.tools ?? []) {
    const tool = graph.tools.get(id);
    for (const file of tool.files) {
      addSource(sources, `tool:${id}`, file);
      put(toolArtifactPath(tool, file), file.bytes, `tool ${id}`);
    }
  }
  if (item.target.record) {
    put("config/target.json", Buffer.from(`${canonicalJson(recordRuntimeConfig(item))}\n`, "utf8"), "record");
    addSource(sources, "record:domainConfigSchema", item.files.get("domainConfigSchema"));
    for (const [role, destination] of [
      ["domainConfig", "config/domain.json"],
      ["renderer", "scripts/domain/renderer.mjs"],
      ["answerContract", `contracts/${basename(item.target.record.answerContract)}`],
    ]) {
      const source = item.files.get(role);
      addSource(sources, `record:${role}`, source);
      put(destination, source.bytes, "record");
    }
    for (const [destination, sourcePath] of RECORD_RUNTIME_ARTIFACTS) {
      const bytes = await readFile(resolve(graph.repositoryRoot, sourcePath));
      put(destination, bytes, "record");
      addSource(sources, `record-runtime:${destination}`, { path: sourcePath, bytes });
    }
  }
  if (item.target.embeddedCoreTooling === "authoring-cli-v1") {
    for (const sourcePath of AUTHORING_CLI_SOURCES) {
      const destination = `${AUTHORING_CLI_ROOT}/${sourcePath}`;
      const bytes = await readFile(resolve(graph.repositoryRoot, sourcePath));
      put(destination, bytes, "embedded authoring CLI");
      addSource(sources, `embedded-core-tooling:${destination}`, { path: sourcePath, bytes });
    }
  }
  assertNoCaseFoldCollisions([...artifacts.keys()], `${targetId} generated artifacts`);
  const folded = new Set([...artifacts.keys()].map((path) => path.toLocaleLowerCase("en-US")));
  for (const path of artifacts.keys()) {
    const parts = path.split("/");
    for (let index = 1; index < parts.length; index += 1) {
      const ancestor = parts.slice(0, index).join("/");
      if (folded.has(ancestor.toLocaleLowerCase("en-US"))) fail("ARTIFACT_COLLISION", `${targetId} would generate ${ancestor} as a file and as the folder of ${path}.`, "Rename the tool or its file so its delivered path differs from every other artifact.");
    }
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
