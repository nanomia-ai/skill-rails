import test from "node:test";
import assert from "node:assert/strict";
import { coreCli } from "./helpers.mjs";

const source = "domains/natural-language-pilot/skill-package.json";

test("inspect returns only graph-derived package, module, target and mechanism relations", () => {
  const moduleResult = coreCli("inspect", "--source", source, "--id", "purpose", "--json");
  assert.equal(moduleResult.status, 0, moduleResult.stdout);
  assert.deepEqual(moduleResult.json.consumers, ["natural-language-pilot-verify-next"]);
  assert.deepEqual(moduleResult.json.checks, []);
  assert.deepEqual(moduleResult.json.externalBoundaries, []);
  assert.equal(moduleResult.json.truncated, false);
  assert.ok(moduleResult.json.gaps.length > 0);

  const targetResult = coreCli("inspect", "--source", source, "--id", "natural-language-pilot-verify-next", "--json");
  assert.equal(targetResult.status, 0, targetResult.stdout);
  assert.equal(targetResult.json.mechanisms.observer, "targets/verify/observer.mjs");
  assert.equal(targetResult.json.mechanisms.renderer, "targets/verify/renderer.mjs");
  assert.equal(targetResult.json.declaredOutput, "pilot/verification.md");

  const pathResult = coreCli("inspect", "--source", source, "--path", "modules/purpose.md", "--json");
  assert.equal(pathResult.status, 0, pathResult.stdout);
  assert.equal(pathResult.json.focus.id, "purpose");
  assert.equal(pathResult.json.sourceGraphSha256, moduleResult.json.sourceGraphSha256);
});

test("inspect rejects fuzzy, case-only, missing and ambiguous forms", () => {
  for (const args of [
    ["--id", "Purpose"],
    ["--id", "verify"],
    ["--path", "modules\\purpose.md"],
  ]) {
    const result = coreCli("inspect", "--source", source, ...args, "--json");
    assert.notEqual(result.status, 0);
    assert.equal(result.json.code, "INSPECT_NOT_FOUND");
  }
  const both = coreCli("inspect", "--source", source, "--id", "purpose", "--path", "modules/purpose.md", "--json");
  assert.notEqual(both.status, 0);
  assert.equal(both.json.code, "ARGUMENT_INVALID");
});
