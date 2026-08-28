import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { collectors, snapshotBasis } from "../skill/collectors/index.mjs";
import { FORMATS } from "../skill/spec.mjs";
import { runInitialDecision, runLane } from "./e2e-host.mjs";

function factMap(decision) {
  return Object.fromEntries(decision.facts.map(({ field, value }) => [field, value]));
}

test("real-state public evidence binds the exact selection and snapshot while reuse and stale proof fail closed", async t => {
  const base = await mkdtemp(join(tmpdir(), "skill-rails-pilot-e2e-"));
  t.after(() => rm(base, { recursive: true, force: true }));

  const publicLane = await runLane(join(base, "paired"), { lane: "public" });
  const controlLane = await runLane(join(base, "paired"), { lane: "control" });
  const waitLane = await runInitialDecision(join(base, "wait"), { channel: "unavailable" });
  const selectionReuseLane = await runLane(join(base, "selection-reuse"), { lane: "public", reuse: "selection" });
  const snapshotReuseLane = await runLane(join(base, "snapshot-reuse"), { lane: "public", reuse: "snapshot" });
  const staleLane = await runLane(join(base, "negative"), { lane: "public", currentness: "stale" });

  assert.equal(relative(resolve(tmpdir()), resolve(base)).startsWith(".."), false, "disposable project must stay under system TEMP");
  assert.deepEqual(publicLane.initialRaw, controlLane.initialRaw, "public and control start from byte-identical semantic state");
  assert.equal(publicLane.acquire.decision.snapshot.fingerprint, controlLane.acquire.decision.snapshot.fingerprint);
  assert.equal(publicLane.final.decision.snapshot.fingerprint, controlLane.final.decision.snapshot.fingerprint);

  assert.equal(waitLane.initial.decision.stage, "channel");
  assert.equal(waitLane.initial.decision.status, "WAIT");
  assert.deepEqual(waitLane.initial.decision.effects, ["WAIT"]);

  for (const lane of [publicLane, controlLane, selectionReuseLane, snapshotReuseLane, staleLane]) {
    assert.equal(lane.acquire.decision.stage, "acquire");
    assert.equal(lane.acquire.decision.status, "NEXT");
    assert.deepEqual(lane.acquire.decision.effects.map(effect => Array.isArray(effect) ? effect[0] : effect), ["RUN", "DISPATCH", "WRITE", "NEXT"]);
    assert.equal(lane.acquire.decision.effects[0][1].input, "state/verifier-channel.json");
    assert.equal(lane.dispatch.executable, lane.usedChannel.argv[0]);
    assert.equal(lane.dispatch.windowsHide, true);
    assert.ok(Array.isArray(lane.dispatch.argv));
    assert.deepEqual(lane.dispatch.argv, lane.usedChannel.argv.slice(1));
    assert.ok(lane.projectRoot.includes(" project"), "Windows argument-array coverage includes a path with spaces");
    assert.ok(lane.dispatch.argv.includes(lane.projectRoot));
    assert.ok(lane.dispatch.argv.includes("--selection"));
    assert.ok(lane.dispatch.argv.includes("--currentness"));
    assert.equal(lane.resultLine.charCodeAt(0) === 0xfeff, false);
    assert.equal(/[\r\n]/.test(lane.resultLine), false);
    assert.equal(await readFile(lane.state.resultPath, "utf8"), `${lane.resultLine}\n`);
    assert.equal((await readdir(lane.state.stateDir)).some(name => name.endsWith(".tmp")), false, "atomic rename must leave no temporary file");

    const basis = await snapshotBasis({ projectRoot: lane.projectRoot });
    assert.equal(basis.kind, "evidence-credit-real-state-v1");
    assert.equal(basis.raw.task, lane.initialRaw.task);
    assert.equal(basis.raw.target, await readFile(lane.state.targetPath, "utf8"));
    assert.equal(basis.raw.channel, lane.initialRaw.channel);
    assert.equal(basis.raw.selection, await readFile(lane.state.selectionPath, "utf8"));
    assert.equal(basis.raw.result, `${lane.resultLine}\n`);
  }

  assert.equal(publicLane.final.decision.stage, "evidence");
  assert.equal(publicLane.final.decision.row, "matching-pass");
  assert.equal(publicLane.final.decision.status, "DONE");
  const publicFacts = factMap(publicLane.final.decision);
  assert.equal(publicFacts["selection.locator"], publicLane.state.selectionLocator);
  assert.equal(publicFacts["selection.hash"], publicLane.state.snapshot);
  assert.equal(publicFacts["result.selection"], publicLane.state.selectionLocator);
  assert.equal(publicFacts["result.selectionHash"], publicLane.state.snapshot);
  assert.equal(publicLane.acquireAlignment.aggregate, "partial");
  assert.equal(publicLane.finalAlignment.aggregate, "unproven");

  const publicUserEvidence = publicLane.events.filter(event => ["agent_claimed", "artifact_verified"].includes(event.authority));
  assert.deepEqual(new Set(publicUserEvidence.map(event => event.type)), new Set(["effect_claimed", "artifact_verified"]));
  assert.equal(publicUserEvidence.filter(event => event.type === "effect_claimed").every(event => event.authority === "agent_claimed"), true);
  const publicClaims = publicUserEvidence.filter(event => event.type === "effect_claimed");
  assert.deepEqual(publicClaims.map(event => event.data.verb), ["RUN", "DISPATCH", "WRITE", "REPORT"]);
  assert.equal(publicClaims.every(event => Object.hasOwn(event.data, "used_channel")), true);
  assert.equal(publicClaims.every(event => JSON.stringify(event.data.used_channel) === JSON.stringify(publicLane.usedChannel)), true);
  const publicArtifacts = publicUserEvidence.filter(event => event.type === "artifact_verified");
  assert.equal(publicArtifacts.length, 1);
  assert.equal(publicArtifacts[0].data.reference, "verifierResult");
  assert.equal(publicArtifacts[0].data.artifact.path, publicArtifacts[0].data.artifact.expected_path);
  assert.equal(publicLane.events.some(event => event.type === "effect_observed"), false, "public lane must never self-assign trusted effect evidence");

  assert.equal(controlLane.final.decision.stage, "evidence");
  assert.equal(controlLane.final.decision.row, "matching-pass");
  assert.equal(controlLane.final.decision.status, "DONE");
  assert.equal(controlLane.acquireAlignment.aggregate, "aligned");
  assert.equal(controlLane.finalAlignment.aggregate, "aligned");
  const controlObserved = controlLane.events.filter(event => event.type === "effect_observed");
  assert.deepEqual(controlObserved.filter(event => event.decision_id === controlLane.acquire.decision.decision_id).map(event => event.data.verb), ["RUN", "DISPATCH", "WRITE"]);
  assert.deepEqual(controlObserved.filter(event => event.decision_id === controlLane.final.decision.decision_id).map(event => event.data.verb), ["REPORT"]);
  assert.equal(controlObserved.every(event => event.authority === "harness_observed" && event.data.control_only === true && event.data.label === "fixture-host-control-only"), true);
  assert.equal(controlLane.events.some(event => event.type === "effect_claimed"), false, "control observations stay isolated from public agent claims");

  for (const lane of [selectionReuseLane, snapshotReuseLane]) {
    assert.equal(lane.final.decision.stage, "evidence");
    assert.equal(lane.final.decision.row, "mismatched-proof");
    assert.equal(lane.final.decision.status, "BLOCK");
    assert.deepEqual(lane.final.decision.effects, ["BLOCK"]);
  }
  const selectionReuseFacts = factMap(selectionReuseLane.final.decision);
  const snapshotReuseFacts = factMap(snapshotReuseLane.final.decision);
  assert.notEqual(selectionReuseFacts["selection.locator"], selectionReuseFacts["result.selection"]);
  assert.notEqual(selectionReuseFacts["selection.hash"], selectionReuseFacts["result.selectionHash"]);
  assert.notEqual(snapshotReuseFacts["task.snapshot"], snapshotReuseFacts["result.snapshot"]);

  assert.equal(staleLane.final.decision.stage, "evidence");
  assert.equal(staleLane.final.decision.row, "stale-proof");
  assert.equal(staleLane.final.decision.status, "BLOCK");
  assert.deepEqual(staleLane.final.decision.effects, ["BLOCK"]);
  assert.equal(staleLane.finalAlignment.aggregate, "aligned", "the closed stale decision itself must be strongly evidenced");
  assert.equal(staleLane.events.some(event => event.type === "effect_observed"), false);

  const resultCollector = collectors["evidence-credit/state.result-verdict"];
  const selectionHashCollector = collectors["evidence-credit/state.selection-hash"];
  const resultPath = publicLane.state.resultPath;
  await writeFile(resultPath, `${publicLane.resultLine}\n${publicLane.resultLine}\n`, "utf8");
  assert.equal(await resultCollector({ projectRoot: publicLane.projectRoot }), "pass");
  for (const invalid of [
    publicLane.resultLine,
    `${publicLane.resultLine}\r\n`,
    `${publicLane.resultLine}\n\n`,
    `malformed\n${publicLane.resultLine}\n`,
    `${publicLane.resultLine}\nmalformed\n`
  ]) {
    await writeFile(resultPath, invalid, "utf8");
    await assert.rejects(resultCollector({ projectRoot: publicLane.projectRoot }));
  }
  await writeFile(publicLane.state.selectionPath, JSON.stringify({
    locator: publicLane.state.selectionLocator,
    sha256: `sha256:${"0".repeat(64)}`
  }), "utf8");
  await assert.rejects(selectionHashCollector({ projectRoot: publicLane.projectRoot }), /declared digest/);
});

test("selection collection fails before hashing plain and symlink or junction escapes", async t => {
  const base = await mkdtemp(join(tmpdir(), "skill-rails-pilot-path-escape-"));
  t.after(() => rm(base, { recursive: true, force: true }));
  const selectionHashCollector = collectors["evidence-credit/state.selection-hash"];

  await assert.rejects(
    runInitialDecision(join(base, "plain-parent"), {
      channel: "available",
      prepare: async ({ projectRoot, state }) => {
        const outsidePath = join(projectRoot, "..", "outside.txt");
        await writeFile(outsidePath, await readFile(state.artifactPath));
        await writeFile(state.selectionPath, JSON.stringify({
          locator: "../outside.txt",
          sha256: state.snapshot
        }), "utf8");
        await selectionHashCollector({ projectRoot });
      }
    }),
    /selection\.json locator escapes the project/
  );

  const escaped = await runInitialDecision(join(base, "linked-parent"), {
    channel: "available",
    prepare: async context => {
        const { projectRoot, state } = context;
        const outsideDir = join(projectRoot, "..", "outside");
        const outsidePath = join(outsideDir, "selected.txt");
        await mkdir(outsideDir, { recursive: true });
        await writeFile(outsidePath, await readFile(state.artifactPath));
        const linkPath = join(state.stateDir, "outside-link");
        await symlink(outsideDir, linkPath, process.platform === "win32" ? "junction" : "dir");
        const locator = "state/outside-link/selected.txt";
        await writeFile(state.selectionPath, JSON.stringify({
          locator,
          sha256: state.snapshot
        }), "utf8");
        const line = FORMATS.verifierResult.render({
          task: context.state.task,
          snapshot: context.state.snapshot,
          selection: locator,
          "selection-hash": context.state.snapshot,
          continuation: context.state.continuation,
          verdict: "pass",
          "recorded-json": { currentness: "current", detail: "escape probe" }
        }, { timestamp: "2026-08-28T00:00:00Z" });
        await writeFile(context.state.resultPath, line + "\n", "utf8");
      }
  });
  assert.equal(escaped.initial.decision.status, "BLOCK");
  assert.match(JSON.stringify(escaped.initial.decision.facts), /selection\.json locator escapes the project/);
});
