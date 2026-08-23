import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { copyTree, isInside, readJson, writeJsonAtomic, writeTextAtomic } from "./io.mjs";
import { validateFull } from "../runtime/validator.mjs";

export async function runMutationSuite(skillRoot) {
  const root = resolve(skillRoot);
  const manifest = await readJson(join(root, "fixtures", "lint", "manifest.json"));
  const cases = manifest.cases ?? [];
  const parent = dirname(root);
  const scratch = join(parent, `.${basename(root)}.mutations-${randomUUID()}`);
  if (!isInside(parent, scratch)) throw new Error(`Unsafe mutation scratch path: ${scratch}`);
  await mkdir(scratch, { recursive: true });
  const results = [];
  try {
    for (const entry of cases) {
      const target = join(scratch, entry.id);
      await copyTree(root, target, { filter: (local) => !local.startsWith(".skill-rails/") });
      await applyMutation(target, entry.mutation.operation);
      const validation = await validateFull(target);
      const killed = validation.diagnostics.some((item) => item.code === entry.expected_code);
      results.push({ id: entry.id, expected_code: entry.expected_code, operation: entry.mutation.operation, killed, observed_codes: [...new Set(validation.diagnostics.map((item) => item.code))].sort() });
      if (!killed) throw new Error(`Critical mutation survived: ${entry.id} expected ${entry.expected_code}, observed ${results.at(-1).observed_codes.join(",") || "none"}`);
    }
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
  return { passed: results.filter((item) => item.killed).length, total: results.length, survivors: results.filter((item) => !item.killed), results };
}

async function applyMutation(root, operation) {
  const specPath = join(root, "spec.mjs");
  const bodyPath = join(root, "body.md");
  const fixturePath = join(root, "fixtures", "scenarios.json");
  let source = await readFile(specPath, "utf8");
  if (operation === "extra-export") source += "\nexport const MUTATION_EXTRA = {};\n";
  else if (operation === "ambient-authority") source = `const mutationAmbient = process.cwd();\n${source}`;
  else if (operation === "observation-source") source = replaceRequired(source, /(\"[^\"]+\"\s*:\s*\{)\s*(?:collector:\s*\"[^\"]+\"|judged:\s*true|decided:\s*true)\s*,/, "$1 ", operation);
  else if (operation === "invalid-domain") source = replaceRequired(source, /domain:\s*(?:\[[^\]]*\]|\"[^\"]+\")/, "domain: []", operation);
  else if (operation === "reads-mismatch") source = replaceRequired(source, /reads:\s*\[[^\]]+\](,\s*(?:acceptsUnknown:\s*\[[^\]]*\],\s*)?done:)/, "reads: []$1", operation);
  else if (operation === "table-default") {
    if (/when:\s*\(\)\s*=>\s*true/.test(source)) source = source.replace(/when:\s*\(\)\s*=>\s*true/, "when: () => false");
    else source = source.replace("export const TABLES = {};", "export const TABLES = { mutation: { exclusive: false, rows: [{ state: \"not-default\", reads: [], when: () => false }] } };");
  } else if (operation === "stage-contract") source = replaceRequired(source, /,\s*(?:record:\s*\{[^}]*\}|reentry:\s*\"[^\"]+\")/, "", operation);
  else if (operation === "artifact-readers") {
    if (/readers:\s*\[[^\]]+\]/.test(source)) source = source.replace(/readers:\s*\[[^\]]+\]/, "readers: []");
    else source = source.replace("export const ARTIFACTS = {};", "export const ARTIFACTS = { mutation: { path: \"state/mutation.log\", writer: SPEC.id, readers: [], update: \"append\", template: null } };");
  } else if (operation === "role-state-effect") {
    if (/effects:\s*\[\]/.test(source) && !source.includes("export const ROLES = {};")) source = source.replace(/effects:\s*\[\]/, 'effects: [["WRITE", { artifact: "mutation" }]]');
    else source = source.replace("export const ROLES = {};", 'export const ROLES = { mutation: { inputs: [], reads: [], effects: [["WRITE", { artifact: "mutation" }]], judgments: {}, returns: null, body: "stage: operate" } };');
  } else if (operation === "format-domain") {
    const bad = 'mutation: { head: "mutation", fields: { value: [] }, render: s => s, parse: s => s }';
    if (source.includes("export const FORMATS = {};")) source = source.replace("export const FORMATS = {};", `export const FORMATS = { ${bad} };`);
    else source = replaceRequired(source, /export const FORMATS = \{/, `export const FORMATS = { ${bad},`, operation);
  }
  else if (operation === "deferred-shape") {
    if (/until:\s*\"[^\"]+\"/.test(source)) source = source.replace(/,\s*until:\s*\"[^\"]+\"/, "");
    else source = source.replace("export const DEFERRED = [];", 'export const DEFERRED = [{ id: "mutation" }];');
  } else if (operation === "unsafe-bypass") {
    if (source.includes("export const GUARDS = [];")) {
      source = source.replace("export const GUARDS = [];", 'export const GUARDS = [{ id: "mutation-bypass", reads: [], when: () => true, then: "BLOCK", unless: { id: "unsafe", reads: ["authoring.readiness"], when: s => s.authoring.readiness === "ready" }, body: "guard: mutation-bypass" }];');
      const body = await readFile(bodyPath, "utf8");
      await writeTextAtomic(bodyPath, body.replace("## stage: operate", "## guard: mutation-bypass\n\nExplain the blocked state without accepting conversational bypass.\n\n## stage: operate"));
      const fixtures = await readJson(fixturePath); fixtures[0].cover.push("guard:mutation-bypass", "unless:mutation-bypass/unsafe"); await writeJsonAtomic(fixturePath, fixtures);
    } else {
      const declaration = /"([a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*)+)"\s*:\s*\{\s*(collector:\s*"[^"]+"|judged:\s*true|decided:\s*true)\s*,/.exec(source);
      if (!declaration) throw new Error("Mutation " + operation + " could not find an observation for an unsafe bypass.");
      const field = declaration[1];
      const access = field.split(".").map((part) => "." + part).join("");
      const bypass = '$1 unless: { id: "unsafe", reads: ["' + field + '"], when: s => s' + access + " === s" + access + " },$2";
      source = replaceRequired(source, /(then:\s*"[^"]+",)(\s*(?:forbids:\s*\[[^\]]*\],\s*)?body:)/, bypass, operation);
      if (declaration[2].startsWith("collector:")) source = source.replace(declaration[0], declaration[0].replace(/collector:\s*"[^"]+"/, "decided: true"));
    }
  }
  if (["body-section", "body-duplicate-procedure", "stage-signature", "template-placeholder", "language-parity", "fixture-coverage", "mutation-manifest", "format-golden"].includes(operation)) {
    await mutateResource(root, operation);
  } else await writeTextAtomic(specPath, source);
}

async function mutateResource(root, operation) {
  const bodyPath = join(root, "body.md");
  if (operation === "body-section") {
    const body = await readFile(bodyPath, "utf8");
    await writeTextAtomic(bodyPath, body.replace(/## stage:[\s\S]*$/, ""));
  } else if (operation === "body-duplicate-procedure") {
    const body = await readFile(bodyPath, "utf8");
    await writeTextAtomic(bodyPath, `${body.trimEnd()}\n\nREAD input → WRITE output\n`);
  } else if (operation === "stage-signature") {
    const body = await readFile(bodyPath, "utf8");
    await writeTextAtomic(bodyPath, body.replace(/^(?:Why|왜):.*$/m, "Rationale omitted."));
  } else if (operation === "template-placeholder") {
    const directory = join(root, "templates");
    const name = (await readdir(directory)).find((item) => item.endsWith(".md"));
    const path = join(directory, name); const text = await readFile(path, "utf8");
    await writeTextAtomic(path, text.replace(/\{\{[a-zA-Z][a-zA-Z0-9]*\}\}/, "removed"));
  } else if (operation === "language-parity") {
    await writeTextAtomic(join(root, "body_ko.md"), "# mismatch\n\n## why: different\n\n불일치\n");
  } else if (operation === "fixture-coverage") {
    const path = join(root, "fixtures", "scenarios.json"); const fixtures = await readJson(path);
    for (const fixture of fixtures) fixture.cover = [];
    await writeJsonAtomic(path, fixtures);
  } else if (operation === "format-golden") {
    const path = join(root, "fixtures", "formats.json");
    let fixtures;
    try { fixtures = await readJson(path); } catch { fixtures = []; }
    if (fixtures.length > 0) {
      const first = fixtures[0];
      const field = Object.keys(first.values ?? {})[0];
      if (field) delete first.values[field];
      else first.expect = `${first.expect ?? ""} mutation`;
    } else fixtures.push({ id: "mutation", format: "missing-format", values: {}, expect: "mutation" });
    await writeJsonAtomic(path, fixtures);
  } else if (operation === "mutation-manifest") {
    const path = join(root, "fixtures", "lint", "manifest.json"); const manifest = await readJson(path);
    manifest.cases = manifest.cases.filter((item) => item.expected_code !== "L17");
    await writeJsonAtomic(path, manifest);
  }
}

function replaceRequired(source, pattern, replacement, operation) {
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`Mutation ${operation} could not find its target.`);
  return next;
}
