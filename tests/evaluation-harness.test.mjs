import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { repositoryRoot, runNode, temporary } from "./helpers.mjs";

const harness = resolve(repositoryRoot, "src/evaluation/harness.mjs");

test("evaluation harness materializes unknown and other-card scenes without overwriting", async (t) => {
  const root = await temporary(t, "evaluation-materialize");
  const unknown = resolve(root, "unknown");
  const unknownResult = runNode([harness, "materialize", "--scene", "unknown", "--project-root", unknown]);
  assert.equal(unknownResult.status, 0, unknownResult.stderr);
  assert.match(await readFile(resolve(unknown, "pilot/plan.md"), "utf8"), /cardName=bookmark-storage/u);

  const repeated = runNode([harness, "materialize", "--scene", "normal", "--project-root", unknown]);
  assert.notEqual(repeated.status, 0);
  assert.match(repeated.stderr, /OUTPUT_EXISTS/u);

  const other = resolve(root, "other-card");
  const otherResult = runNode([harness, "materialize", "--scene", "other-card-update", "--project-root", other]);
  assert.equal(otherResult.status, 0, otherResult.stderr);
  const output = await readFile(resolve(other, "pilot/verification.md"), "utf8");
  assert.match(output, /### another-card — unproven/u);
  assert.match(output, /Keep this prefix byte-for-byte\./u);
});

test("evaluation harness injects input stale only after an exchange appears and captures the host", async (t) => {
  const root = await temporary(t, "evaluation-inject");
  const project = resolve(root, "project");
  const receipt = resolve(root, "receipt.json");
  const materialized = runNode([harness, "materialize", "--scene", "input-stale", "--project-root", project]);
  assert.equal(materialized.status, 0, materialized.stderr);

  const fakeHost = [
    "const fs=require('fs');",
    "fs.mkdirSync('.skill-rails-next/exchanges/fixture',{recursive:true});",
    "fs.writeFileSync('.skill-rails-next/exchanges/fixture/exchange.json','{}');",
    "setTimeout(()=>{const p=fs.readFileSync('pilot/plan.md','utf8');console.log(p.includes('Concurrent plan change after prepare.'));},200);",
  ].join("");
  const captured = runNode([
    harness, "run", "--scene", "input-stale", "--project-root", project,
    "--receipt", receipt, "--watch-timeout-ms", "5000", "--", process.execPath, "-e", fakeHost,
  ]);
  assert.equal(captured.status, 0, captured.stderr);
  const result = JSON.parse(await readFile(receipt, "utf8"));
  assert.equal(result.injection.relativePath, "pilot/plan.md");
  assert.match(result.stdout.utf8, /true/u);
  assert.equal(result.hostExitCode, 0);
  assert.equal(result.injectionError, null);
});

test("response-loss proxy swallows exactly one successful record response", async (t) => {
  const root = await temporary(t, "evaluation-response-loss");
  const entry = resolve(root, "installed/scripts/run.mjs");
  const stateRoot = resolve(root, ".skill-rails-next");
  await mkdir(resolve(root, "installed/scripts"), { recursive: true });
  await mkdir(stateRoot, { recursive: true });
  await writeFile(entry, "process.stdout.write(JSON.stringify({status:'APPLIED',sha256:'fixture-hash'})+'\\n');\n", "utf8");
  const proxy = resolve(repositoryRoot, "src/evaluation/node-response-loss-proxy.mjs");
  const env = { ...process.env, SKILL_RAILS_EVAL_REAL_NODE: process.execPath, SKILL_RAILS_EVAL_PROJECT_ROOT: root };

  const first = runNode([proxy, entry, "record"], { env });
  assert.equal(first.status, 86);
  assert.equal(first.stdout, "");
  assert.match(first.stderr, /EVALUATION_RESPONSE_LOST_AFTER_APPLY/u);
  const state = JSON.parse(await readFile(resolve(stateRoot, "evaluation-response-loss.json"), "utf8"));
  assert.equal(state.actualStatus, "APPLIED");
  assert.equal(state.actualOutputSha256, "fixture-hash");

  const second = runNode([proxy, entry, "record"], { env });
  assert.equal(second.status, 0, second.stderr);
  assert.equal(second.json.status, "APPLIED");
});

test("prepare-failure variant is a valid built target with the canonical fallback source", async (t) => {
  const root = await temporary(t, "evaluation-prepare-failure");
  const packageRoot = resolve(root, "package");
  const built = runNode(["src/evaluation/build-prepare-failure-target.mjs", packageRoot]);
  assert.equal(built.status, 0, built.stderr);
  assert.equal(built.json.status, "BUILT_PREPARE_FAILURE_VARIANT");
  assert.notEqual(built.json.originalObserverSha256, built.json.faultObserverSha256);
  assert.equal(built.json.fallbackSourceSha256, "dde7f3f8ee23044a8102c49e2d8e381ea8aaf236d4126f03e8f24f5a75a6ecfb");
  const checked = runNode([
    resolve(packageRoot, "skills/natural-language-pilot-verify-next/scripts/run.mjs"),
    "check",
  ]);
  assert.equal(checked.status, 0, checked.stderr);
  assert.equal(checked.json.status, "ARTIFACT_INTACT");
});

test("capture sanitizer removes unrelated host hook payloads but keeps evidence events", async (t) => {
  const root = await temporary(t, "evaluation-sanitize");
  const receipt = resolve(root, "capture.json");
  const stream = [
    JSON.stringify({ type: "system", subtype: "hook_response", hook_name: "fixture", output: "private hook body", outcome: "success" }),
    JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "kept evidence" }] } }),
    "",
  ].join("\n");
  await writeFile(receipt, JSON.stringify({ stdout: { utf8: stream } }), "utf8");
  const sanitized = runNode([harness, "sanitize", "--receipt", receipt]);
  assert.equal(sanitized.status, 0, sanitized.stderr);
  const result = JSON.parse(await readFile(receipt, "utf8"));
  assert.equal(result.stdout.redactions, 1);
  assert.doesNotMatch(result.stdout.utf8, /private hook body/u);
  assert.match(result.stdout.utf8, /kept evidence/u);
  assert.match(result.stdout.utf8, /payloadRedacted/u);
});
