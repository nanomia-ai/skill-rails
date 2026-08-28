import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { appendFile, mkdir, open, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ARTIFACTS, FORMATS } from "../skill/spec.mjs";
import { readTrace, recordHarnessEvidence } from "../skill/scripts/skill-rails/trace-core.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const pilotRoot = resolve(here, "..");
const skillRoot = join(pilotRoot, "skill");
const runPath = join(skillRoot, "scripts", "skill-rails", "run.mjs");
const verifierPath = join(here, "verifier.mjs");
const resultTimestamp = "2026-08-28T00:00:00Z";

function declaredArtifactPath(projectRoot, artifactId) {
  return join(projectRoot, ARTIFACTS[artifactId].path);
}

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

async function writeUtf8Atomic(path, content) {
  if (content.charCodeAt(0) === 0xfeff || content.includes("\r")) throw new Error(`Refusing non-UTF-8/LF fixture content for ${path}`);
  await mkdir(dirname(path), { recursive: true });
  const temporary = join(dirname(path), `.${randomUUID()}.tmp`);
  await writeFile(temporary, Buffer.from(content, "utf8"), { flag: "wx" });
  await rename(temporary, path);
}

function execNode(argv, { cwd, allowedExitCodes = [0] } = {}) {
  return new Promise((fulfill, reject) => {
    execFile(argv[0], argv.slice(1), {
      cwd,
      windowsHide: true,
      encoding: "utf8",
      maxBuffer: 1024 * 1024
    }, (error, stdout, stderr) => {
      const code = error?.code ?? 0;
      if (!allowedExitCodes.includes(code)) {
        const failure = new Error(`Node child exited ${code}: ${stderr || error?.message || "unknown error"}`);
        failure.cause = error;
        failure.stdout = stdout;
        failure.stderr = stderr;
        reject(failure);
        return;
      }
      fulfill({ code, stdout, stderr, executable: argv[0], argv: argv.slice(1), windowsHide: true });
    });
  });
}

async function runtimeJson(args, options = {}) {
  const child = await execNode([process.execPath, runPath, ...args, "--json"], { cwd: pilotRoot, ...options });
  return { child, value: JSON.parse(child.stdout) };
}

async function stage(projectRoot, traceDir, runId, stagePath) {
  const result = await runtimeJson([
    "stage", "--skill", skillRoot, "--project", projectRoot, "--trace-dir", traceDir,
    "--run-id", runId, "--decided", "intent.token=verify"
  ], { allowedExitCodes: [0, 2] });
  await writeUtf8Atomic(stagePath, JSON.stringify(result.value));
  return result;
}

async function publicRecord(decisionPath, type, data, extra = []) {
  return runtimeJson([
    "record", "--skill", skillRoot, "--decision", decisionPath,
    "--type", type, "--data", JSON.stringify(data), ...extra
  ]);
}

async function publicAlign(decisionPath) {
  return runtimeJson(["align", "--skill", skillRoot, "--decision", decisionPath], { allowedExitCodes: [0, 2] });
}

async function createProject(projectRoot, { currentness = "current", channel = "available" } = {}) {
  const stateDir = join(projectRoot, "state");
  const targetDir = join(projectRoot, "target");
  const artifactPath = join(targetDir, "artifact.txt");
  const alternateArtifactPath = join(targetDir, "artifact-other.txt");
  const task = "task-real-17";
  const continuation = "continuation-real-a";
  const artifact = "agent-grade real target\nwith exact LF bytes\n";
  const alternateArtifact = "different selected target\nwith exact LF bytes\n";
  const snapshot = sha256(Buffer.from(artifact, "utf8"));
  const alternateSnapshot = sha256(Buffer.from(alternateArtifact, "utf8"));
  const selectionLocator = "target/artifact.txt";
  const alternateSelectionLocator = "target/artifact-other.txt";
  const target = JSON.stringify({ artifact: "target/artifact.txt", sha256: snapshot, continuation });
  const alternateTarget = JSON.stringify({ artifact: alternateSelectionLocator, sha256: alternateSnapshot, continuation });
  const selection = JSON.stringify({ locator: selectionLocator, sha256: snapshot });
  const alternateSelection = JSON.stringify({ locator: alternateSelectionLocator, sha256: alternateSnapshot });
  const channelInput = {
    argv: [
      process.execPath,
      verifierPath,
      "--project", projectRoot,
      "--target", declaredArtifactPath(projectRoot, "targetState"),
      "--task", task,
      "--snapshot", snapshot,
      "--continuation", continuation,
      "--selection", declaredArtifactPath(projectRoot, "selectionState"),
      "--currentness", currentness
    ]
  };

  await mkdir(stateDir, { recursive: true });
  await mkdir(targetDir, { recursive: true });
  await writeUtf8Atomic(artifactPath, artifact);
  await writeUtf8Atomic(alternateArtifactPath, alternateArtifact);
  await writeUtf8Atomic(declaredArtifactPath(projectRoot, "taskState"), task);
  await writeUtf8Atomic(declaredArtifactPath(projectRoot, "targetState"), target);
  await writeUtf8Atomic(declaredArtifactPath(projectRoot, "channelStatus"), channel);
  await writeUtf8Atomic(declaredArtifactPath(projectRoot, "channelInput"), JSON.stringify(channelInput));
  await writeUtf8Atomic(declaredArtifactPath(projectRoot, "selectionState"), selection);

  return {
    task, snapshot, continuation, artifactPath, alternateArtifactPath,
    selectionLocator, alternateSelectionLocator, alternateSnapshot, alternateTarget, alternateSelection,
    stateDir,
    resultPath: declaredArtifactPath(projectRoot, "verifierResult"),
    channelPath: declaredArtifactPath(projectRoot, "channelStatus"),
    channelInputPath: declaredArtifactPath(projectRoot, "channelInput"),
    channelInput,
    targetPath: declaredArtifactPath(projectRoot, "targetState"),
    selectionPath: declaredArtifactPath(projectRoot, "selectionState"),
    initialRaw: { task, target, channel, selection, result: null }
  };
}

async function acquireChannel(channelInputPath) {
  const handle = await open(channelInputPath, "r");
  try {
    const input = JSON.parse(await handle.readFile("utf8"));
    const hasArgv = Array.isArray(input?.argv) && input.argv.length > 0 && input.argv.every(item => typeof item === "string" && item.length > 0);
    const hasApprover = typeof input?.approver === "string" && input.approver.length > 0;
    if (hasArgv === hasApprover) throw new Error("The verifier channel must contain exactly one nonempty argv array or approver string.");
    return input;
  } finally {
    await handle.close();
  }
}

async function dispatchVerifier(projectRoot, channelInput) {
  if (!Array.isArray(channelInput.argv)) throw new Error("This focused fixture exercises only the Node argv channel.");
  const argv = channelInput.argv;
  const child = await execNode(argv, { cwd: projectRoot });
  if (child.stdout.charCodeAt(0) === 0xfeff || child.stdout.includes("\r") || !child.stdout.endsWith("\n") || child.stdout.slice(0, -1).includes("\n")) {
    throw new Error("Verifier stdout must be one UTF-8/LF JSON line.");
  }
  return { child, result: JSON.parse(child.stdout.slice(0, -1)) };
}

function renderResult(result) {
  const line = FORMATS.verifierResult.render({
    task: result.task,
    snapshot: result.snapshot,
    selection: result.selection,
    "selection-hash": result.selectionHash,
    continuation: result.continuation,
    verdict: result.verdict,
    "recorded-json": result.recordedJson
  }, { timestamp: resultTimestamp });
  if (typeof line !== "string" || line.includes("\r") || line.includes("\n")) throw new Error("Canonical verifierResult rendering failed.");
  const parsed = FORMATS.verifierResult.parse(line);
  if (!parsed.ok) throw new Error(`Canonical verifierResult parse failed: ${parsed.reason}`);
  return line;
}

async function publicClaim(decisionPath, index, verb, lane, usedChannel) {
  return publicRecord(decisionPath, "effect_claimed", {
    kind: "effect", index, verb, lane, used_channel: usedChannel, authority_boundary: "agent-claim-only"
  });
}

async function controlObservation(traceDir, runId, decision, index, verb) {
  return recordHarnessEvidence({
    skillRoot, traceDir, runId, decision, type: "effect_observed",
    data: { kind: "effect", index, verb, lane: "control", control_only: true, label: "fixture-host-control-only" }
  });
}

async function executeLaneReport(projectRoot, finalDecision) {
  const text = finalDecision.template_text
    .replaceAll("{{status}}", finalDecision.status)
    .replaceAll("{{reference}}", "references/verify.md")
    .replaceAll("{{evidence}}", JSON.stringify(finalDecision.facts));
  const path = join(projectRoot, "state", "lane-report.md");
  await writeUtf8Atomic(path, text);
  return path;
}

export async function runLane(root, { lane, currentness = "current", reuse = null }) {
  if (!new Set(["public", "control"]).has(lane)) throw new Error(`Unknown lane: ${lane}`);
  if (![null, "selection", "snapshot"].includes(reuse)) throw new Error(`Unknown reuse mutation: ${reuse}`);
  const projectRoot = join(resolve(root), `${lane} project`);
  const traceDir = join(resolve(root), `${lane} trace`);
  const runId = `${lane}-${randomUUID()}`;
  const state = await createProject(projectRoot, { currentness });
  await mkdir(traceDir, { recursive: true });

  const acquirePath = join(root, `${lane}-acquire-stage.json`);
  const initial = await stage(projectRoot, traceDir, runId, acquirePath);
  if (initial.value.decision.stage !== "acquire" || initial.value.decision.status !== "NEXT") {
    throw new Error(`Expected no-result acquire NEXT, received ${initial.value.decision.stage}/${initial.value.decision.status}`);
  }
  const verbs = initial.value.decision.effects.map(effect => Array.isArray(effect) ? effect[0] : effect);
  if (verbs.join(",") !== "RUN,DISPATCH,WRITE,NEXT") throw new Error(`Unexpected acquire order: ${verbs.join(",")}`);

  const usedChannel = await acquireChannel(state.channelInputPath);
  if (lane === "public") await publicClaim(acquirePath, 0, "RUN", lane, usedChannel);
  else await controlObservation(traceDir, runId, initial.value.decision, 0, "RUN");

  const dispatched = await dispatchVerifier(projectRoot, usedChannel);
  if (lane === "public") await publicClaim(acquirePath, 1, "DISPATCH", lane, usedChannel);
  else await controlObservation(traceDir, runId, initial.value.decision, 1, "DISPATCH");

  const resultLine = renderResult(dispatched.result);
  await appendFile(state.resultPath, Buffer.from(`${resultLine}\n`, "utf8"), { flag: "a" });
  if (lane === "public") await publicClaim(acquirePath, 2, "WRITE", lane, usedChannel);
  else await controlObservation(traceDir, runId, initial.value.decision, 2, "WRITE");
  await publicRecord(acquirePath, "artifact_verified", {
    reference: "verifierResult", lane, authority_boundary: "path-and-bytes-only"
  }, ["--artifact", state.resultPath, "--project", projectRoot]);

  if (reuse === "selection") await writeUtf8Atomic(state.selectionPath, state.alternateSelection);
  if (reuse === "snapshot") await writeUtf8Atomic(state.targetPath, state.alternateTarget);

  const finalPath = join(root, `${lane}-final-stage.json`);
  const final = await stage(projectRoot, traceDir, runId, finalPath);
  let reportPath = null;
  if (final.value.decision.effects.some(effect => Array.isArray(effect) && effect[0] === "REPORT")) {
    reportPath = await executeLaneReport(projectRoot, final.value.decision);
    const reportIndex = final.value.decision.effects.findIndex(effect => Array.isArray(effect) && effect[0] === "REPORT");
    if (lane === "public") await publicClaim(finalPath, reportIndex, "REPORT", lane, usedChannel);
    else await controlObservation(traceDir, runId, final.value.decision, reportIndex, "REPORT");
  }

  const acquireAlignment = await publicAlign(acquirePath);
  const finalAlignment = await publicAlign(finalPath);
  const events = await readTrace(initial.value.trace_path);
  return {
    lane, projectRoot, traceDir, runId, state, initialRaw: state.initialRaw,
    acquire: initial.value, final: final.value,
    acquireAlignment: acquireAlignment.value,
    finalAlignment: finalAlignment.value,
    events, resultLine, reportPath, usedChannel,
    dispatch: dispatched.child
  };
}

export async function runInitialDecision(root, { channel, prepare = null }) {
  const projectRoot = join(resolve(root), `initial-${channel} project`);
  const traceDir = join(resolve(root), `initial-${channel} trace`);
  const runId = `initial-${channel}-${randomUUID()}`;
  const state = await createProject(projectRoot, { channel });
  if (prepare) await prepare({ projectRoot, state });
  await mkdir(traceDir, { recursive: true });
  const stagePath = join(root, `initial-${channel}-stage.json`);
  const initial = await stage(projectRoot, traceDir, runId, stagePath);
  return { projectRoot, traceDir, runId, state, stagePath, initial: initial.value };
}

export const realStatePaths = Object.freeze({ here, pilotRoot, skillRoot, runPath, verifierPath });
