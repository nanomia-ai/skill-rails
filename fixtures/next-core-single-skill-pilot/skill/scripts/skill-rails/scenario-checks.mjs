import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { evaluateSpec } from "./evaluator.mjs";
import { sha256 } from "./hash.mjs";
import { MINIMUM_NODE_MAJOR } from "./constants.mjs";
import { prepareFixtureInputs } from "./observations.mjs";

export async function loadScenarioFixtures(skillRoot) {
  const path = join(resolve(skillRoot), "fixtures", "scenarios.json");
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return []; }
}

export async function validateScenarioExpectations(skillRoot, spec, fixtures) {
  const diagnostics = [];
  const runtime = {
    version: "fixture-validation",
    spec_hash: sha256(spec.SPEC),
    runtime_hash: sha256("fixture-validation"),
    dsl_hash: sha256("fixture-validation"),
    validator_version: "fixture-validation",
    validator_hash: sha256("fixture-validation"),
    minimum_node_major: MINIMUM_NODE_MAJOR
  };
  for (const fixture of fixtures) {
    const pointer = `fixtures/scenarios.json:${fixture?.id ?? "<missing>"}`;
    if (!fixture?.id || !fixture.expect || typeof fixture.expect !== "object") {
      diagnostics.push(diag(pointer, "Scenario fixture requires a stable id and expect object."));
      continue;
    }
    try {
      const { observations, snapshot, judged, decided } = prepareFixtureInputs(spec, fixture);
      const decision = await evaluateSpec({
        spec, skillRoot: resolve(skillRoot), observations,
        snapshot, judged, decided, runtime
      });
      for (const field of ["stage", "row", "status"]) {
        if (Object.hasOwn(fixture.expect, field) && decision[field] !== fixture.expect[field]) diagnostics.push(diag(`${pointer}.expect.${field}`, `Expected ${field}=${fixture.expect[field]}, got ${decision[field]}.`));
      }
      if (Object.hasOwn(fixture.expect, "guard")) {
        const actual = decision.guard?.id ?? "none";
        if (actual !== fixture.expect.guard) diagnostics.push(diag(`${pointer}.expect.guard`, `Expected guard=${fixture.expect.guard}, got ${actual}.`));
      }
      if (Array.isArray(fixture.expect.effects)) {
        const actual = decision.effects.map((item) => Array.isArray(item) ? item[0] : item);
        if (JSON.stringify(actual) !== JSON.stringify(fixture.expect.effects)) diagnostics.push(diag(`${pointer}.expect.effects`, `Expected effects ${JSON.stringify(fixture.expect.effects)}, got ${JSON.stringify(actual)}.`));
      }
      if (Array.isArray(fixture.expect.stage_artifacts)) {
        const actual = decision.stage_artifacts.map(({ id, path }) => ({ id, path }));
        if (JSON.stringify(actual) !== JSON.stringify(fixture.expect.stage_artifacts)) diagnostics.push(diag(`${pointer}.expect.stage_artifacts`, `Expected stage artifacts ${JSON.stringify(fixture.expect.stage_artifacts)}, got ${JSON.stringify(actual)}.`));
      }
    } catch (error) {
      diagnostics.push(diag(pointer, `Scenario evaluation failed: ${error.message}`));
    }
  }
  return diagnostics;
}

function diag(pointer, message) { return { code: "L14", pointer, message, hint: null, level: "error" }; }
