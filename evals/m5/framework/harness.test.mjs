import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { materializeLaneEntry, transcriptMetrics } from "./harness.mjs";
import { validateJsonSchema } from "../../../src/core/validate.mjs";
import { repositoryRoot } from "../../../tests/helpers.mjs";

test("Framework lanes vary only the anchored exposure sentence", async () => {
  const source = await readFile(resolve(repositoryRoot, "authoring/skill-rails/SKILL.source.md"), "utf8");
  const protocol = JSON.parse(await readFile(resolve(repositoryRoot, "evals/m5/framework/protocol.json"), "utf8"));
  const normalized = Object.values(protocol.lanes).map((lane) => materializeLaneEntry(source, lane.instruction).replace(lane.instruction, "{{FRAMEWORK_EXPOSURE}}"));
  assert.equal(new Set(normalized).size, 1);
  assert.doesNotMatch(normalized[0], /Author one smallest sufficient target/u);
});

test("Framework fixture revision excludes its protocol-dependent self-test without exposing evals", async () => {
  const protocol = JSON.parse(await readFile(resolve(repositoryRoot, "evals/m5/framework/protocol.json"), "utf8"));
  assert.equal(protocol.fixtureRevision, 3);
  assert.ok(protocol.fixture.copiedEntries.includes("tests"));
  assert.ok(protocol.fixture.excludedEntries.includes("tests/framework-harness.test.mjs"));
  assert.ok(!protocol.fixture.copiedEntries.some((entry) => entry === "evals" || entry.startsWith("evals/")));
});

test("superseded fixture evidence remains a closed receipt", async () => {
  const schema = JSON.parse(await readFile(resolve(repositoryRoot, "evals/m5/framework/fixture-classification.schema.json"), "utf8"));
  const receipt = JSON.parse(await readFile(resolve(repositoryRoot, "evals/m5/results/framework/v2/fixture-classification.json"), "utf8"));
  assert.deepEqual(validateJsonSchema(receipt, schema), []);
});

test("framework receipt metrics preserve Claude cache usage and observed bounded reads", () => {
  const lines = [
    { type: "assistant", message: { content: [{ type: "tool_use", id: "read-index", name: "Read", input: { file_path: "references/universalFrameworkOriginal.index.json" } }] } },
    { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "read-index", content: "index bytes" }] } },
    { type: "assistant", message: { content: [{ type: "tool_use", id: "read-framework", name: "Read", input: { file_path: "references/universalFrameworkOriginal.md", offset: 2, limit: 20 } }] } },
    { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "read-framework", content: "framework range" }] } },
    { type: "result", total_cost_usd: 1.25, usage: { input_tokens: 10, cache_creation_input_tokens: 20, cache_read_input_tokens: 30, output_tokens: 40, output_tokens_details: { thinking_tokens: 5 } } },
  ];
  const measured = transcriptMetrics("claude", Buffer.from(`${lines.map((line) => JSON.stringify(line)).join("\n")}\n`, "utf8"));
  assert.equal(measured.tokens.billedInputTokens, 60);
  assert.deepEqual(measured.tokens.claude, { uncachedInput: 10, cacheCreate: 20, cacheRead: 30, output: 40, thinking: 5 });
  assert.equal(measured.claudeTotalCostUsd, 1.25);
  assert.equal(measured.tools.count, 2);
  assert.equal(measured.indexReturnedBytes, Buffer.byteLength("index bytes"));
  assert.deepEqual(measured.frameworkReads, [{ source: "package-reference", primitive: "Read", rangeKind: "lines", returnedBytes: Buffer.byteLength("framework range") }]);
});

test("framework receipt metrics keep Codex usage host-local and expose repository-source reads", () => {
  const lines = [
    { type: "item.completed", item: { id: "one", type: "command_execution", command: "rg -n '^##' docs/guide/ai-skill-evolution-method_ko.md", aggregated_output: "12:## section" } },
    { type: "item.completed", item: { id: "two", type: "file_change" } },
    { type: "turn.completed", usage: { input_tokens: 100, cached_input_tokens: 70, output_tokens: 30, reasoning_output_tokens: 20 } },
  ];
  const measured = transcriptMetrics("codex", Buffer.from(`${lines.map((line) => JSON.stringify(line)).join("\n")}\n`, "utf8"));
  assert.equal(measured.tokens.billedInputTokens, 100);
  assert.deepEqual(measured.tokens.codex, { inputTotal: 100, cachedInput: 70, output: 30, reasoning: 20 });
  assert.equal(measured.tokens.claude, null);
  assert.equal(measured.tools.count, 2);
  assert.equal(measured.tools.byKind.search, 1);
  assert.equal(measured.tools.byKind.edit, 1);
  assert.deepEqual(measured.frameworkReads, [{ source: "repository-original", primitive: "command_execution", rangeKind: "search", returnedBytes: Buffer.byteLength("12:## section") }]);
});
