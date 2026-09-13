import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { repositoryRoot } from "../../tests/helpers.mjs";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("M4 protocol fixes paired lanes, hosts, scenes, prompt, and canonical control source", async () => {
  const protocolBytes = await readFile(resolve(repositoryRoot, "fixtures/verify-v1/experiment-protocol.json"));
  const protocol = JSON.parse(protocolBytes);
  assert.equal(protocol.schemaVersion, 1);
  assert.deepEqual(protocol.lanes, ["control", "treatment"]);
  assert.deepEqual(protocol.hosts.map(({ adapter }) => adapter), ["codex", "claude-code"]);
  assert.equal(protocol.scenes.length, 7);
  assert.match(protocol.prompt, /bookmark-storage/u);
  const control = await readFile(resolve(repositoryRoot, protocol.controlSource));
  assert.equal(sha256(control), "dde7f3f8ee23044a8102c49e2d8e381ea8aaf236d4126f03e8f24f5a75a6ecfb");
  assert.ok(protocol.measurements.includes("safetyViolations"));
  assert.ok(protocol.measurements.includes("packetBytes"));
  assert.equal(typeof sha256(protocolBytes), "string");
});
