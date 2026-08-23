import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { hashFile, sha256 } from "./hash.mjs";
import { MINIMUM_NODE_MAJOR, RUNTIME_VERSION, VALIDATOR_VERSION } from "./constants.mjs";
import { fail } from "./diagnostics.mjs";

const VALIDATOR_FILES = new Set(["ast-policy.mjs", "validator.mjs", "scenario-checks.mjs", "format-checks.mjs", "authoring-ledger.mjs", "constants.mjs", "domains.mjs", "diagnostics.mjs"]);
const AUTHORING_EVIDENCE_FILES = new Set([".skill-rails/intent.json", ".skill-rails/profile-decision.json", ".skill-rails/eval-cases.json", ".skill-rails/obligation-ledger.json"]);

export async function computeFingerprints(skillRoot, runtimeDir = join(resolve(skillRoot), "scripts", "skill-rails")) {
  const root = resolve(skillRoot);
  const runtimeRoot = resolve(runtimeDir);
  const runtimeFiles = (await listFiles(runtimeRoot)).sort();
  const specHash = await hashFile(join(root, "spec.mjs"));
  const dslPath = join(runtimeRoot, "dsl.mjs");
  const dslHash = await hashFile(dslPath);
  const validatorParts = [];
  const runtimeParts = [];
  for (const path of runtimeFiles) {
    const entry = `${relative(runtimeRoot, path).replace(/\\/g, "/")}:${await hashFile(path)}`;
    if (VALIDATOR_FILES.has(basename(path))) validatorParts.push(entry);
    else if (path !== dslPath) runtimeParts.push(entry);
  }
  const contentFiles = (await listFiles(root)).filter((path) => isRuntimeContent(root, path)).sort();
  const content = {};
  for (const path of contentFiles) content[relative(root, path).replace(/\\/g, "/")] = await hashFile(path);
  for (const local of AUTHORING_EVIDENCE_FILES) {
    try { content[local] = await hashFile(join(root, ...local.split("/"))); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  return {
    spec_hash: specHash,
    dsl_hash: dslHash,
    runtime_hash: sha256(runtimeParts.join("\n")),
    validator_hash: sha256(validatorParts.join("\n")),
    content_hash: sha256(content),
    content,
    runtime_files: runtimeFiles.map((path) => relative(runtimeRoot, path).replace(/\\/g, "/")),
    validator_version: VALIDATOR_VERSION,
    runtime_version: RUNTIME_VERSION,
    minimum_node_major: MINIMUM_NODE_MAJOR
  };
}

export async function createManifest(skillRoot, options = {}) {
  const root = resolve(skillRoot);
  const fingerprints = await computeFingerprints(root, options.runtimeDir);
  const generatedFiles = {};
  for (const path of options.generatedFiles ?? []) {
    if (!safeRelativePath(path)) fail("SR_MANIFEST_PATH", "Generated manifest paths must be portable package-relative paths.", { pointer: path });
    const absolute = resolve(root, path);
    generatedFiles[relative(root, absolute).replace(/\\/g, "/")] = await hashFile(absolute);
  }
  return {
    schema: "skill-rails/build-manifest/1",
    skill_id: options.skillId,
    profile: "p2",
    built_at: options.builtAt ?? null,
    build_id: sha256({ fingerprints, generatedFiles, evidence: options.evidence ?? {} }),
    ...fingerprints,
    generated_files: generatedFiles,
    evidence: options.evidence ?? {},
    origin: options.origin ?? null,
    manual_edit_policy: "canonical-source-only"
  };
}

export async function writeManifest(skillRoot, manifest) {
  const path = join(resolve(skillRoot), ".generated.json");
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return path;
}

export async function readManifest(skillRoot) {
  const path = join(resolve(skillRoot), ".generated.json");
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch (error) { fail("SR_MANIFEST_MISSING", "P2 package requires a readable .generated.json. Rebuild the skill.", { pointer: path, cause: error, hint: "Run the package build command." }); }
}

export async function verifyManifest(skillRoot, options = {}) {
  const root = resolve(skillRoot);
  const manifest = await readManifest(skillRoot);
  const runningNodeMajor = Number(process.versions.node.split(".")[0]);
  if (!Number.isInteger(runningNodeMajor) || runningNodeMajor < manifest.minimum_node_major) {
    fail("SR_NODE_VERSION", `This package requires Node ${manifest.minimum_node_major} or newer; running ${process.versions.node}.`, { pointer: ".generated.json:minimum_node_major" });
  }
  const current = await computeFingerprints(skillRoot, options.runtimeDir);
  const fields = ["spec_hash", "dsl_hash", "runtime_hash", "validator_hash", "content_hash", "validator_version", "runtime_version", "minimum_node_major"];
  const mismatches = fields.filter((field) => manifest[field] !== current[field]).map((field) => ({ field, expected: manifest[field], actual: current[field] }));
  const requiredGenerated = new Set([
    "SKILL.md", "agents/openai.yaml", "schemas/decision.schema.json", "schemas/trace-event.schema.json",
    ...current.runtime_files.map((path) => `scripts/skill-rails/${path}`)
  ]);
  for (const path of requiredGenerated) if (!Object.hasOwn(manifest.generated_files ?? {}, path)) mismatches.push({ field: `generated_files.${path}`, expected: "recorded", actual: "missing-entry" });
  for (const [path, expected] of Object.entries(manifest.generated_files ?? {})) {
    if (!safeRelativePath(path)) {
      mismatches.push({ field: `generated_files.${path}`, expected, actual: "unsafe-path" });
      continue;
    }
    try {
      const actual = await hashFile(join(root, path));
      if (actual !== expected) mismatches.push({ field: `generated_files.${path}`, expected, actual });
    } catch { mismatches.push({ field: `generated_files.${path}`, expected, actual: "missing" }); }
  }
  const expectedBuildId = sha256({ fingerprints: current, generatedFiles: manifest.generated_files ?? {}, evidence: manifest.evidence ?? {} });
  if (manifest.build_id !== expectedBuildId) mismatches.push({ field: "build_id", expected: expectedBuildId, actual: manifest.build_id ?? null });
  if (mismatches.length) fail("SR_MANIFEST_MISMATCH", "Build manifest does not match the current package. Rebuild before execution.", { pointer: ".generated.json", details: mismatches });
  return { manifest, current };
}

export async function detectGeneratedEdits(skillRoot) {
  const manifest = await readManifest(skillRoot);
  const changes = [];
  for (const [path, expected] of Object.entries(manifest.generated_files ?? {})) {
    if (!safeRelativePath(path)) {
      changes.push({ path, expected, actual: null, status: "unsafe-path" });
      continue;
    }
    try {
      const actual = await hashFile(join(resolve(skillRoot), path));
      if (actual !== expected) changes.push({ path, expected, actual, status: "modified" });
    } catch { changes.push({ path, expected, actual: null, status: "missing" }); }
  }
  return changes;
}

async function listFiles(root) {
  const output = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (["node_modules", ".git", ".skill-rails"].includes(entry.name)) continue;
    const path = join(root, entry.name);
    if (entry.isDirectory()) output.push(...await listFiles(path));
    else if (entry.isFile()) output.push(path);
    else if (entry.isSymbolicLink()) fail("SR_PACKAGE_SYMLINK", "P2 packages must be self-contained and may not contain symlinks or junctions.", { pointer: path });
    else fail("SR_PACKAGE_ENTRY", "P2 packages may contain only regular files and directories.", { pointer: path });
  }
  return output;
}

function safeRelativePath(path) {
  if (typeof path !== "string" || path.length === 0 || isAbsolute(path)) return false;
  const normalized = path.replace(/\\/g, "/");
  return normalized === path && normalized.split("/").every((segment) => segment && segment !== "." && segment !== "..") && !normalized.includes(":");
}

function isRuntimeContent(root, path) {
  const local = relative(root, path).replace(/\\/g, "/");
  if (local === ".generated.json" || local.startsWith("agents/")) return false;
  if (local === "spec.mjs" || local.startsWith("scripts/skill-rails/")) return false;
  return local === "body.md" || local === "body_ko.md" || local.startsWith("templates/") || local.startsWith("references/") || local.startsWith("collectors/") || local.startsWith("fixtures/") || local === "SKILL.md";
}
