#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function parseArguments(values) {
  const options = {};
  let index = 0;
  for (; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--") break;
    if (!value.startsWith("--") || index + 1 >= values.length) throw new Error(`ARGUMENT_INVALID:${value}`);
    options[value.slice(2)] = values[index + 1];
    index += 1;
  }
  return { options, command: values.slice(index + 1) };
}

async function fileObservation(path) {
  try {
    const bytes = await readFile(path);
    return { exists: true, bytes: bytes.length, sha256: sha256(bytes) };
  } catch (error) {
    if (error?.code === "ENOENT") return { exists: false, bytes: 0, sha256: null };
    throw error;
  }
}

function sanitizeHostStream(bytes) {
  const lines = bytes.toString("utf8").split(/\r?\n/u);
  let redactions = 0;
  const sanitized = lines.map((line) => {
    if (!line) return line;
    let event;
    try { event = JSON.parse(line); } catch { return line; }
    if (event.type === "system" && ["hook_started", "hook_response"].includes(event.subtype)) {
      redactions += 1;
      return JSON.stringify({ type: event.type, subtype: event.subtype, hook_name: event.hook_name ?? null, outcome: event.outcome ?? null, payloadRedacted: true });
    }
    if (event.type === "system" && event.subtype === "init") {
      redactions += 1;
      return JSON.stringify({ type: event.type, subtype: event.subtype, cwd: event.cwd ?? null, model: event.model ?? null, permissionMode: event.permissionMode ?? null, hostInventoryRedacted: true });
    }
    return line;
  });
  return { bytes: Buffer.from(sanitized.join("\n"), "utf8"), redactions };
}

async function requireAbsent(path) {
  try {
    await stat(path);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  throw new Error(`OUTPUT_EXISTS:${path}`);
}

async function runProcess(executable, args, { cwd, input, env = process.env } = {}) {
  const started = performance.now();
  const child = spawn(executable, args, { cwd, env, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  const stdout = [];
  const stderr = [];
  child.stdout.on("data", (chunk) => stdout.push(chunk));
  child.stderr.on("data", (chunk) => stderr.push(chunk));
  if (input === undefined) child.stdin.end();
  else child.stdin.end(input);
  const result = await new Promise((completion, rejection) => {
    child.once("error", rejection);
    child.once("close", (code, signal) => completion({ code, signal }));
  });
  return {
    ...result,
    wallClockMs: Math.round(performance.now() - started),
    stdout: Buffer.concat(stdout),
    stderr: Buffer.concat(stderr),
  };
}

async function seedOtherCard(projectRoot) {
  const outputPath = resolve(projectRoot, "pilot/verification.md");
  const current = await readFile(outputPath);
  const answer = {
    schemaVersion: 1,
    cardId: "another-card",
    verdict: "unproven",
    summary: "Pre-existing evaluator seed that the bookmark-storage update must preserve.",
    checks: [{ name: "seed remains distinguishable", outcome: "unproven", evidence: [] }],
    unknowns: ["This record is evaluator setup, not a fresh-agent verification claim."],
  };
  const request = Buffer.from(JSON.stringify({ currentOutputBase64: current.toString("base64"), validatedAnswer: answer }));
  const renderer = resolve(repositoryRoot, "domains/natural-language-pilot/targets/verify/renderer.mjs");
  const rendered = await runProcess(process.execPath, [renderer], { input: request });
  if (rendered.code !== 0) throw new Error(`SEED_RENDER_FAILED:${rendered.stderr.toString("utf8").trim()}`);
  await writeFile(outputPath, rendered.stdout);
}

async function materialize(options) {
  const scene = options.scene;
  const projectRoot = resolve(options["project-root"] ?? "");
  const supported = new Set(["normal", "other-card-update", "unknown", "command-failure", "input-stale", "output-conflict", "prepare-failure-fallback", "record-response-loss-retry"]);
  if (!supported.has(scene)) throw new Error(`SCENE_INVALID:${scene}`);
  if (!options["project-root"]) throw new Error("PROJECT_ROOT_REQUIRED");
  await requireAbsent(projectRoot);
  const fixtureName = scene === "command-failure" ? "failure-project" : "project";
  const fixtureRoot = resolve(repositoryRoot, "fixtures/verify-v1", fixtureName);
  await mkdir(dirname(projectRoot), { recursive: true });
  await cp(fixtureRoot, projectRoot, { recursive: true, errorOnExist: true, force: false });
  if (scene === "unknown") {
    const planPath = resolve(projectRoot, "pilot/plan.md");
    const current = await readFile(planPath, "utf8");
    const changed = current.replace("fixture-plan cardId=bookmark-storage", "fixture-plan cardName=bookmark-storage");
    if (changed === current) throw new Error("UNKNOWN_MUTATION_ANCHOR_MISSING");
    await writeFile(planPath, changed, "utf8");
  }
  if (scene === "other-card-update") await seedOtherCard(projectRoot);
  const receipt = {
    schemaVersion: 1,
    phase: "materialized",
    scene,
    fixture: `fixtures/verify-v1/${fixtureName}`,
    projectRoot,
    output: await fileObservation(resolve(projectRoot, "pilot/verification.md")),
  };
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
}

async function exchangeCount(projectRoot) {
  const root = resolve(projectRoot, ".skill-rails-next/exchanges");
  try {
    const entries = await readdir(root, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).length;
  } catch (error) {
    if (error?.code === "ENOENT") return 0;
    throw error;
  }
}

async function injectAfterPrepare(scene, projectRoot, initialCount, timeoutMs) {
  if (!new Set(["input-stale", "output-conflict"]).has(scene)) return null;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await exchangeCount(projectRoot) > initialCount) {
      const relativePath = scene === "input-stale" ? "pilot/plan.md" : "pilot/verification.md";
      const path = resolve(projectRoot, relativePath);
      const addition = scene === "input-stale" ? "\nConcurrent plan change after prepare.\n" : "\nConcurrent terminal note.\n";
      const before = await fileObservation(path);
      const current = await readFile(path);
      await writeFile(path, Buffer.concat([current, Buffer.from(addition, "utf8")]));
      return { relativePath, before, after: await fileObservation(path) };
    }
    await new Promise((completion) => setTimeout(completion, 25));
  }
  throw new Error(`PREPARE_WATCH_TIMEOUT:${timeoutMs}`);
}

async function responseLossEnvironment(scene, projectRoot) {
  if (scene !== "record-response-loss-retry") return { env: process.env, statePath: null };
  if (process.platform !== "win32") throw new Error("RESPONSE_LOSS_PROXY_REQUIRES_WINDOWS");
  const proxyRoot = resolve(projectRoot, ".skill-rails-next/evaluation-bin");
  const proxySource = resolve(repositoryRoot, "src/evaluation/node-response-loss-proxy.mjs");
  const proxyDestination = resolve(proxyRoot, "node-response-loss-proxy.mjs");
  await mkdir(proxyRoot, { recursive: true });
  await cp(proxySource, proxyDestination, { force: false, errorOnExist: true });
  const command = `@\"${process.execPath}\" \"${proxyDestination}\" %*\r\n`;
  await writeFile(resolve(proxyRoot, "node.cmd"), command, "utf8");
  return {
    env: {
      ...process.env,
      PATH: `${proxyRoot};${process.env.PATH ?? ""}`,
      SKILL_RAILS_EVAL_REAL_NODE: process.execPath,
      SKILL_RAILS_EVAL_PROJECT_ROOT: projectRoot,
    },
    statePath: resolve(projectRoot, ".skill-rails-next/evaluation-response-loss.json"),
  };
}

async function run(options, command) {
  if (command.length === 0) throw new Error("HOST_COMMAND_REQUIRED");
  const scene = options.scene;
  const projectRoot = resolve(options["project-root"] ?? "");
  const receiptPath = resolve(options.receipt ?? "");
  if (!scene || !options["project-root"] || !options.receipt) throw new Error("SCENE_PROJECT_ROOT_RECEIPT_REQUIRED");
  const outputPath = resolve(projectRoot, "pilot/verification.md");
  const outputBefore = await fileObservation(outputPath);
  const initialCount = await exchangeCount(projectRoot);
  const timeoutMs = Number(options["watch-timeout-ms"] ?? 120000);
  const startedAt = new Date().toISOString();
  const responseLoss = await responseLossEnvironment(scene, projectRoot);
  const hostPromise = runProcess(command[0], command.slice(1), { cwd: projectRoot, env: responseLoss.env });
  let injected = null;
  let injectionError = null;
  try {
    injected = await injectAfterPrepare(scene, projectRoot, initialCount, timeoutMs);
  } catch (error) {
    injectionError = error instanceof Error ? error.message : String(error);
  }
  const host = await hostPromise;
  const sanitizedStdout = sanitizeHostStream(host.stdout);
  const receipt = {
    schemaVersion: 1,
    phase: "host-captured",
    scene,
    startedAt,
    projectRoot,
    command,
    hostExitCode: host.code,
    hostSignal: host.signal,
    wallClockMs: host.wallClockMs,
    injection: injected,
    injectionError,
    outputBefore,
    outputAfter: await fileObservation(outputPath),
    responseLossProxy: responseLoss.statePath ? {
      state: await fileObservation(responseLoss.statePath),
      details: (await fileObservation(responseLoss.statePath)).exists ? JSON.parse(await readFile(responseLoss.statePath, "utf8")) : null,
    } : null,
    stdout: { bytes: sanitizedStdout.bytes.length, sha256: sha256(sanitizedStdout.bytes), utf8: sanitizedStdout.bytes.toString("utf8"), redactions: sanitizedStdout.redactions },
    stderr: { bytes: host.stderr.length, sha256: sha256(host.stderr), utf8: host.stderr.toString("utf8") },
    interpretation: null,
    claimPolicy: "Captured process and filesystem facts are observed; semantic acceptance and causality require review and remain null until interpreted.",
  };
  await mkdir(dirname(receiptPath), { recursive: true });
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ receiptPath, hostExitCode: host.code, outputAfter: receipt.outputAfter })}\n`);
  if (host.code !== 0 || injectionError) process.exitCode = 1;
}

async function sanitizeReceipt(options) {
  if (!options.receipt) throw new Error("RECEIPT_REQUIRED");
  const receiptPath = resolve(options.receipt);
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
  if (typeof receipt.stdout?.utf8 !== "string") throw new Error("CAPTURE_STDOUT_MISSING");
  const sanitized = sanitizeHostStream(Buffer.from(receipt.stdout.utf8, "utf8"));
  receipt.stdout = { bytes: sanitized.bytes.length, sha256: sha256(sanitized.bytes), utf8: sanitized.bytes.toString("utf8"), redactions: (receipt.stdout.redactions ?? 0) + sanitized.redactions };
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ receiptPath, redactions: sanitized.redactions, stdout: { bytes: receipt.stdout.bytes, sha256: receipt.stdout.sha256 } })}\n`);
}

const [action, ...rest] = process.argv.slice(2);
const { options, command } = parseArguments(rest);
if (action === "materialize") await materialize(options);
else if (action === "run") await run(options, command);
else if (action === "sanitize") await sanitizeReceipt(options);
else throw new Error("Usage: harness.mjs materialize ... | run ... -- <host command> | sanitize --receipt <capture>");
