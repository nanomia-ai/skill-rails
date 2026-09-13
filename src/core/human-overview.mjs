import { relative } from "node:path";
import { canonicalJson, compareCodePoint, sha256 } from "./canonicalize.mjs";
import { planTargetBuild } from "./build.mjs";

const GENERATOR_VERSION = 1;

function entryDescription(text) {
  const frontmatterEnd = text.indexOf("\n---\n", 4);
  if (!text.startsWith("---\n") || frontmatterEnd < 0) return null;
  const line = text.slice(4, frontmatterEnd).split("\n").find((candidate) => candidate.startsWith("description:"));
  return line?.slice("description:".length).trim() || null;
}

function representativeFlow(target) {
  if (target.mode === "record-only") return `SKILL.md → initialize → AI answer → record → ${target.declaredOutput}`;
  if (target.mode === "prepare-record") return `SKILL.md → prepare/observer → AI answer → record → ${target.declaredOutput}`;
  return "SKILL.md → AI judgment and host action";
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
      mode: item.target.mode,
      role: entryDescription(item.files.get("entry").text),
      source: item.path,
      entry: item.files.get("entry").path,
      imports: [...item.target.imports],
      fallback: item.target.fallbackModule ?? null,
      headingIndex: item.target.headingIndex ?? null,
      artifacts: plan.receipt.artifacts.map((artifact) => artifact.path),
      observer: item.files.get("observer")?.path ?? null,
      renderer: item.files.get("renderer")?.path ?? null,
      contract: item.files.get("answerContract")?.path ?? null,
      inputs: item.target.declaredInputs ?? [],
      output: item.target.declaredOutput ?? null,
      flow: representativeFlow(item.target),
    });
  }
  const modules = [...graph.modules.values()]
    .map((module) => ({
      id: module.id,
      path: module.path,
      consumers: targets.filter((target) => target.imports.includes(module.id) || target.fallback === module.id).map((target) => target.id),
    }))
    .sort((left, right) => compareCodePoint(left.id, right.id));
  const projectionInput = {
    schemaVersion: 1,
    package: { id: graph.manifest.packageId, version: graph.manifest.packageVersion, manifest: manifestPath },
    modules,
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
  lines.push("", "## Target catalog", "");
  targets.forEach((target, index) => {
    lines.push(
      `### ${index + 1}. \`${target.id}\``,
      "",
      `- Role: ${target.role ?? "not declared in entry frontmatter"}`,
      `- Mode: \`${target.mode}\``,
      `- Canonical source: \`${target.source}\`; entry: \`${target.entry}\``,
      `- Imports: ${list(target.imports)}`,
      `- Fallback module: ${target.fallback ? `\`${target.fallback}\`` : "none"}; heading index: ${target.headingIndex ? `\`${target.headingIndex}\`` : "none"}`,
      `- Mechanisms: observer ${target.observer ? `\`${target.observer}\`` : "none"}; renderer ${target.renderer ? `\`${target.renderer}\`` : "none"}; contract ${target.contract ? `\`${target.contract}\`` : "none"}`,
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
