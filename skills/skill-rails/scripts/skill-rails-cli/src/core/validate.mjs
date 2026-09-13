import { readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, canonicalText, compareCodePoint, sha256 } from "./canonicalize.mjs";
import { fail } from "./errors.mjs";
import { assertNoCaseFoldCollisions, normalizeRelativePath, resolveContainedFile, resolveContainedFileFrom, sourceRootFor } from "./paths.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export function validateJsonSchema(value, schema, at = "$") {
  const errors = [];
  const visit = (current, rule, path) => {
    if (rule.oneOf) {
      const candidates = rule.oneOf.map((candidate) => {
        const before = errors.length;
        visit(current, candidate, path);
        const result = errors.splice(before);
        return result;
      });
      const passing = candidates.filter((candidate) => candidate.length === 0).length;
      if (passing !== 1) errors.push(`${path} must match exactly one allowed shape`);
      return;
    }
    if (Object.hasOwn(rule, "const") && canonicalJson(current) !== canonicalJson(rule.const)) errors.push(`${path} must equal ${JSON.stringify(rule.const)}`);
    if (rule.enum && !rule.enum.some((item) => canonicalJson(item) === canonicalJson(current))) errors.push(`${path} is not an allowed value`);
    if (rule.type) {
      const actual = current === null ? "null" : Array.isArray(current) ? "array" : Number.isInteger(current) ? "integer" : typeof current;
      const typeMatches = rule.type === actual || (rule.type === "number" && typeof current === "number");
      if (!typeMatches) {
        errors.push(`${path} must be ${rule.type}`);
        return;
      }
    }
    if (typeof current === "string") {
      if (rule.minLength !== undefined && current.length < rule.minLength) errors.push(`${path} is too short`);
      if (rule.pattern && !new RegExp(rule.pattern, "u").test(current)) errors.push(`${path} does not match ${rule.pattern}`);
    }
    if (typeof current === "number" && rule.minimum !== undefined && current < rule.minimum) errors.push(`${path} is below minimum`);
    if (Array.isArray(current)) {
      if (rule.minItems !== undefined && current.length < rule.minItems) errors.push(`${path} has too few items`);
      if (rule.uniqueItems) {
        const keys = current.map(canonicalJson);
        if (new Set(keys).size !== keys.length) errors.push(`${path} has duplicate items`);
      }
      if (rule.items) current.forEach((item, index) => visit(item, rule.items, `${path}[${index}]`));
    }
    if (current && typeof current === "object" && !Array.isArray(current)) {
      const keys = Object.keys(current);
      if (rule.minProperties !== undefined && keys.length < rule.minProperties) errors.push(`${path} has too few properties`);
      for (const required of rule.required ?? []) if (!Object.hasOwn(current, required)) errors.push(`${path}.${required} is required`);
      if (rule.propertyNames?.pattern) {
        const pattern = new RegExp(rule.propertyNames.pattern, "u");
        for (const key of keys) if (!pattern.test(key)) errors.push(`${path} property ${key} is invalid`);
      }
      for (const key of keys) {
        if (rule.properties?.[key]) visit(current[key], rule.properties[key], `${path}.${key}`);
        else if (rule.additionalProperties === false) errors.push(`${path}.${key} is not allowed`);
        else if (rule.additionalProperties && typeof rule.additionalProperties === "object") visit(current[key], rule.additionalProperties, `${path}.${key}`);
      }
    }
  };
  visit(value, schema, at);
  return errors;
}

export async function readJsonFile(path, logicalPath = path) {
  const bytes = await readFile(path);
  const text = canonicalText(bytes, logicalPath);
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    fail("JSON_INVALID", `${logicalPath} is not valid JSON: ${error.message}`, "Correct the canonical JSON source.");
  }
  assertNoDuplicateJsonKeys(text, logicalPath);
  return { value, text, bytes: Buffer.from(text, "utf8") };
}

function assertNoDuplicateJsonKeys(text, logicalPath) {
  let index = 0;
  const whitespace = () => { while (/\s/u.test(text[index] ?? "")) index += 1; };
  const string = () => {
    const start = index;
    index += 1;
    while (index < text.length) {
      if (text[index] === "\\") { index += 2; continue; }
      if (text[index] === '"') { index += 1; return JSON.parse(text.slice(start, index)); }
      index += 1;
    }
    return "";
  };
  const value = () => {
    whitespace();
    if (text[index] === "{") {
      index += 1; whitespace();
      const keys = new Set();
      while (text[index] !== "}") {
        const key = string();
        if (keys.has(key)) fail("JSON_KEY_COLLISION", `${logicalPath} repeats object key ${JSON.stringify(key)}.`, "Keep each canonical JSON key exactly once.");
        keys.add(key); whitespace(); index += 1; value(); whitespace();
        if (text[index] === ",") { index += 1; whitespace(); } else break;
      }
      index += 1; return;
    }
    if (text[index] === "[") {
      index += 1; whitespace();
      while (text[index] !== "]") { value(); whitespace(); if (text[index] === ",") { index += 1; whitespace(); } else break; }
      index += 1; return;
    }
    if (text[index] === '"') { string(); return; }
    while (index < text.length && !/[\s,}\]]/u.test(text[index])) index += 1;
  };
  value();
}

async function readContract(name) {
  return (await readJsonFile(resolve(repositoryRoot, "contracts", name), `contracts/${name}`)).value;
}

function assertSchema(value, schema, label) {
  const errors = validateJsonSchema(value, schema);
  if (errors.length) fail("SCHEMA_INVALID", `${label} violates its closed schema.`, "Correct the canonical source fields.", errors);
}

export async function loadSourceGraph(manifestPath) {
  const { manifestReal, rootReal } = await sourceRootFor(manifestPath);
  const manifestRead = await readJsonFile(manifestReal, relative(rootReal, manifestReal).replaceAll("\\", "/"));
  if (manifestRead.value?.schemaVersion !== 1) fail("UNSUPPORTED_VERSION", "The source package schemaVersion is not supported.", "Use source package schemaVersion 1.");
  assertSchema(manifestRead.value, await readContract("source-package.schema.json"), "source package");
  const manifest = manifestRead.value;
  assertNoCaseFoldCollisions(Object.keys(manifest.modules), "module IDs");
  assertNoCaseFoldCollisions(Object.keys(manifest.targets), "target aliases");

  const modules = new Map();
  const sourcePathSpellings = [];
  for (const [id, sourcePath] of Object.entries(manifest.modules).sort(([a], [b]) => compareCodePoint(a, b))) {
    const resolved = await resolveContainedFile(rootReal, sourcePath, `module ${id}`);
    const text = canonicalText(await readFile(resolved.physical), resolved.normalized);
    modules.set(id, { id, path: resolved.normalized, physical: resolved.physical, text, bytes: Buffer.from(text, "utf8") });
    sourcePathSpellings.push(resolved.normalized);
  }

  const targetSchema = await readContract("target.schema.json");
  const targets = new Map();
  for (const [alias, targetPath] of Object.entries(manifest.targets).sort(([a], [b]) => compareCodePoint(a, b))) {
    const resolvedTarget = await resolveContainedFile(rootReal, targetPath, `target ${alias}`);
    const targetRead = await readJsonFile(resolvedTarget.physical, resolvedTarget.normalized);
    if (targetRead.value?.schemaVersion !== 1) fail("UNSUPPORTED_VERSION", `Target ${alias} uses an unsupported schemaVersion.`, "Use target schemaVersion 1.");
    assertSchema(targetRead.value, targetSchema, `target ${alias}`);
    const target = targetRead.value;
    if (targets.has(target.targetId)) fail("TARGET_COLLISION", `Duplicate targetId: ${target.targetId}`, "Give every target one unique ID.");
    for (const imported of target.imports) if (!modules.has(imported)) fail("IMPORT_MISSING", `${target.targetId} imports missing module ${imported}.`, "Declare the module or correct the target imports.");
    if (target.headingIndex && !target.imports.includes(target.headingIndex)) fail("HEADING_INDEX_UNDECLARED", `${target.targetId} headingIndex is not an imported module: ${target.headingIndex}.`, "Import the exact module selected for the generated heading index.");
    if (target.fallbackModule && !modules.has(target.fallbackModule)) fail("IMPORT_MISSING", `${target.targetId} names missing fallback module ${target.fallbackModule}.`, "Declare the fallback module.");

    const files = new Map();
    const targetRootReal = dirname(resolvedTarget.physical);
    const addFile = async (role, path) => {
      const resolved = await resolveContainedFileFrom(rootReal, targetRootReal, path, `${target.targetId} ${role}`);
      const text = canonicalText(await readFile(resolved.physical), resolved.normalized);
      files.set(role, { role, path: resolved.normalized, physical: resolved.physical, text, bytes: Buffer.from(text, "utf8") });
      sourcePathSpellings.push(resolved.normalized);
    };
    await addFile("entry", target.entry);
    if (target.mode !== "prose") {
      await addFile("domainConfig", target.domainConfig);
      await addFile("domainConfigSchema", target.domainConfigSchema);
      if (target.packet) await addFile("packet", target.packet);
      if (target.observer) await addFile("observer", target.observer);
      await addFile("renderer", target.renderer);
      await addFile("answerContract", target.answerContract);
      const config = (await readJsonFile(files.get("domainConfig").physical, files.get("domainConfig").path)).value;
      const configSchema = (await readJsonFile(files.get("domainConfigSchema").physical, files.get("domainConfigSchema").path)).value;
      assertSchema(config, configSchema, `${target.targetId} domain config`);
      await readJsonFile(files.get("answerContract").physical, files.get("answerContract").path);
      if (target.mode === "prepare-record") {
        const packet = (await readJsonFile(files.get("packet").physical, files.get("packet").path)).value;
        assertSchema(packet, await readContract("packet-kernel.schema.json"), `${target.targetId} packet kernel`);
        if (!target.imports.includes(packet.purposeModule)) fail("IMPORT_MISSING", `${target.targetId} packet purposeModule is not imported: ${packet.purposeModule}`, "Add the module to imports or correct packet.json.");
        const availableReads = new Set([...target.declaredInputs, ...target.imports.map((id) => `references/${id}.md`)]);
        for (const read of packet.reads) if (!availableReads.has(read.path)) fail("PACKET_READ_UNDECLARED", `${target.targetId} packet read is not declared or materialized: ${read.path}`, "Declare the input or imported reference before exposing it to the AI.");
      }
      target.declaredInputs.forEach((path) => normalizeRelativePath(path, `${target.targetId} declared input`));
      normalizeRelativePath(target.declaredOutput, `${target.targetId} declared output`);
    }
    targets.set(target.targetId, { alias, path: resolvedTarget.normalized, physical: resolvedTarget.physical, bytes: targetRead.bytes, target, files });
    sourcePathSpellings.push(resolvedTarget.normalized);
  }
  assertNoCaseFoldCollisions([...targets.keys()], "target IDs");
  assertNoCaseFoldCollisions(sourcePathSpellings, "source paths");
  if (rootReal === repositoryRoot) {
    for (const spelling of sourcePathSpellings) if (spelling === "legacy" || spelling.startsWith("legacy/")) fail("LEGACY_REFERENCE_FORBIDDEN", `Active source references archived legacy path: ${spelling}`, "Move the requirement into current canonical source without importing legacy runtime material.");
  }

  const packageJson = await readJsonFile(resolve(repositoryRoot, "package.json"), "package.json");
  return {
    repositoryRoot,
    rootReal,
    manifestPath: manifestReal,
    manifest,
    manifestBytes: manifestRead.bytes,
    modules,
    targets,
    coreVersion: packageJson.value.version,
    sourceGraphSha256: sha256(Buffer.from(canonicalJson({
      manifest: JSON.parse(manifestRead.text),
      sources: [...modules.values(), ...[...targets.values()].flatMap((item) => [{ path: item.path, bytes: item.bytes }, ...item.files.values()])]
        .map((item) => ({ path: item.path, sha256: sha256(item.bytes) }))
        .sort((a, b) => compareCodePoint(a.path, b.path)),
    }), "utf8")),
  };
}
