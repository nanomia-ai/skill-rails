import { relative } from "node:path";
import { canonicalJson, compareCodePoint, sha256 } from "./canonicalize.mjs";
import { planTargetBuild } from "./build.mjs";

const GENERATOR_VERSION = 2;

function entryDescription(text) {
  const frontmatterEnd = text.indexOf("\n---\n", 4);
  if (!text.startsWith("---\n") || frontmatterEnd < 0) return null;
  const line = text.slice(4, frontmatterEnd).split("\n").find((candidate) => candidate.startsWith("description:"));
  return line?.slice("description:".length).trim() || null;
}

function representativeFlow(target) {
  const tools = target.tools?.length ? ` with tools ${target.tools.map((id) => `\`${id}\``).join(", ")}` : "";
  if (target.record) return `SKILL.md → AI judgment${tools} → initialize → AI answer → record → \`${target.record.declaredOutput}\``;
  return `SKILL.md → AI judgment and host action${tools}`;
}

function list(values, empty = "none declared") {
  return values.length ? values.map((value) => `\`${value}\``).join(", ") : empty;
}

export async function buildHumanOverview(graph) {
  const manifestPath = relative(graph.rootReal, graph.manifestPath).replaceAll("\\", "/");
  const targets = [];
  for (const item of [...graph.targets.values()].sort((left, right) => compareCodePoint(left.target.targetId, right.target.targetId))) {
    const plan = await planTargetBuild(graph, item.target.targetId);
    targets.push({
      id: item.target.targetId,
      role: entryDescription(item.files.get("entry").text),
      source: item.path,
      entry: item.files.get("entry").path,
      imports: [...item.target.imports],
      tools: [...(item.target.tools ?? [])],
      headingIndex: item.target.headingIndex ?? null,
      artifacts: plan.receipt.artifacts.map((artifact) => artifact.path),
      renderer: item.files.get("renderer")?.path ?? null,
      contract: item.files.get("answerContract")?.path ?? null,
      inputs: item.target.record?.declaredInputs ?? [],
      output: item.target.record?.declaredOutput ?? null,
      flow: representativeFlow(item.target),
    });
  }
  const modules = [...graph.modules.values()]
    .map((module) => ({
      id: module.id,
      path: module.path,
      consumers: targets.filter((target) => target.imports.includes(module.id)).map((target) => target.id),
    }))
    .sort((left, right) => compareCodePoint(left.id, right.id));
  const tools = [...graph.tools.values()]
    .map((tool) => ({
      id: tool.id,
      path: tool.path,
      consumers: targets.filter((target) => target.tools.includes(tool.id)).map((target) => target.id),
    }))
    .sort((left, right) => compareCodePoint(left.id, right.id));
  const projectionInput = {
    schemaVersion: 2,
    package: { id: graph.manifest.packageId, version: graph.manifest.packageVersion, manifest: manifestPath },
    modules,
    tools,
    targets,
  };
  const projectionInputSha256 = sha256(Buffer.from(canonicalJson(projectionInput), "utf8"));
  const lines = [
    "<!-- generated: true; authoritative: false; do not edit -->",
    "# Source graph overview",
    "",
    `- generatorVersion: \`${GENERATOR_VERSION}\``,
    `- sourceGraphSha256: \`${graph.sourceGraphSha256}\``,
    `- projectionInputSha256: \`${projectionInputSha256}\``,
    "- currentness: `current-at-generation`",
    "- sourcePathCheck: `passed`",
    "- stale warning: a saved copy is stale when a newly generated `projectionInputSha256` differs; this on-demand output is not an authority.",
    "",
    "## Package and purpose ownership",
    "",
    `- Package: \`${graph.manifest.packageId}\` \`${graph.manifest.packageVersion}\``,
    `- Canonical manifest: \`${manifestPath}\``,
    "- Product purpose is owned by each canonical target entry and its imported modules; this projection shows the current entry description without redefining it.",
    "",
    "## Shared modules and consumers",
    "",
  ];
  if (modules.length === 0) lines.push("- None declared.");
  for (const module of modules) lines.push(`- \`${module.id}\` — \`${module.path}\`; consumers: ${list(module.consumers)}`);
  lines.push("", "## Tools and consumers", "");
  if (tools.length === 0) lines.push("- None declared.");
  for (const tool of tools) lines.push(`- \`${tool.id}\` — \`${tool.path}\`; consumers: ${list(tool.consumers)}`);
  lines.push("", "## Target catalog", "");
  targets.forEach((target, index) => {
    lines.push(
      `### ${index + 1}. \`${target.id}\``,
      "",
      `- Role: ${target.role ?? "not declared in entry frontmatter"}`,
      `- Canonical source: \`${target.source}\`; entry: \`${target.entry}\``,
      `- Imports: ${list(target.imports)}`,
      `- Tools: ${list(target.tools)}; heading index: ${target.headingIndex ? `\`${target.headingIndex}\`` : "none"}`,
      `- Record: renderer ${target.renderer ? `\`${target.renderer}\`` : "none"}; contract ${target.contract ? `\`${target.contract}\`` : "none"}`,
      `- Declared inputs: ${list(target.inputs)}`,
      `- Declared output: ${target.output ? `\`${target.output}\`` : "none declared"}`,
      `- Generated artifacts: ${list(target.artifacts)}`,
      `- Representative flow: ${target.flow}`,
      "",
    );
  });
  lines.push(
    "## Reading boundary",
    "",
    "This projection reports only the current declared graph and build artifact paths. It does not prove semantic correctness, AI behavior, external effects, or undeclared requirement/check/external-boundary relationships.",
    "",
  );
  return { markdown: lines.join("\n"), projectionInputSha256 };
}
