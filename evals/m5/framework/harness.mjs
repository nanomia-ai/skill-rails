#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { validateJsonSchema } from "../../../src/core/validate.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const protocolPath = resolve(repositoryRoot, "evals/m5/framework/protocol.json");
const receiptSchemaPath = resolve(repositoryRoot, "evals/m5/framework/receipt.schema.v2.json");
const classificationSchemaPath = resolve(repositoryRoot, "evals/m5/framework/preflight-classification.schema.json");
const resultsBaseRoot = resolve(repositoryRoot, "evals/m5/results/framework");
const resultsRoot = resolve(resultsBaseRoot, "v2");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function parseArguments(values) {
  const options = {};
  for (let index = 0; index < values.length; index += 2) {
    if (!values[index]?.startsWith("--") || values[index + 1] === undefined) throw new Error(`ARGUMENT_INVALID:${values[index] ?? "missing"}`);
    options[values[index].slice(2)] = values[index + 1];
  }
  return options;
}

async function json(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function exists(path) {
  try { await stat(path); return true; } catch (error) { if (error?.code === "ENOENT") return false; throw error; }
}

async function run(executable, args, { cwd, input } = {}) {
  const started = performance.now();
  const child = spawn(executable, args, { cwd, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  const stdout = [];
  const stderr = [];
  child.stdout.on("data", (chunk) => stdout.push(chunk));
  child.stderr.on("data", (chunk) => stderr.push(chunk));
  child.stdin.end(input);
  const result = await new Promise((complete, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => complete({ code, signal }));
  });
  return { ...result, wallClockMs: Math.round(performance.now() - started), stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) };
}

async function copyWorkspace(projectRoot, protocol) {
  const exclusions = new Set(protocol.fixture.excludedEntries);
  for (const entry of protocol.fixture.copiedEntries) {
    if (entry !== "tests") {
      await cp(resolve(repositoryRoot, entry), resolve(projectRoot, entry), { recursive: true, errorOnExist: true, force: false });
      continue;
    }
    await mkdir(resolve(projectRoot, entry), { recursive: true });
    for (const child of await readdir(resolve(repositoryRoot, entry), { withFileTypes: true })) {
      const logicalPath = `${entry}/${child.name}`;
      if (exclusions.has(logicalPath)) continue;
      await cp(resolve(repositoryRoot, logicalPath), resolve(projectRoot, logicalPath), { recursive: true, errorOnExist: true, force: false });
    }
  }
  await mkdir(resolve(projectRoot, "fixture"), { recursive: true });
}

export const frameworkInstruction = "Before making an authoring or maintenance judgment, read §§0–0.1 of `references/skillEvolutionMethod.md`. Use its routing table and the decision's uncertainty, reach, and reversal cost to choose any additional sections. The generated `references/skillEvolutionMethod.index.json` is only a byte-range navigation aid; it does not define meaning or a closed task taxonomy.";

export function materializeLaneEntry(entry, instruction) {
  const changed = entry.replace(frameworkInstruction, instruction);
  if (changed === entry) throw new Error("LANE_INSTRUCTION_ANCHOR_MISSING");
  return changed;
}

async function installLane(projectRoot, lane, host, protocol) {
  const laneRoot = resolve(projectRoot, ".lane-source");
  await mkdir(resolve(laneRoot, "target"), { recursive: true });
  const canonicalEntry = await readFile(resolve(projectRoot, "authoring/skill-rails/SKILL.source.md"), "utf8");
  const entry = materializeLaneEntry(canonicalEntry, protocol.lanes[lane].instruction);
  await writeFile(resolve(laneRoot, "entry.md"), entry, "utf8");
  const usesFramework = lane !== "L0";
  const manifest = {
    schemaVersion: 1,
    packageId: "skill-rails-authoring-evaluation",
    packageVersion: "1.0.0-m5",
    modules: usesFramework ? { universalFrameworkOriginal: "docs/guide/ai-skill-evolution-method_ko.md" } : {},
    targets: { authoring: ".lane-source/target/target.json" },
  };
  const target = { schemaVersion: 1, targetId: "skill-rails-next", mode: "prose", entry: "../entry.md", imports: usesFramework ? ["universalFrameworkOriginal"] : [] };
  if (usesFramework) target.headingIndex = "universalFrameworkOriginal";
  const manifestPath = resolve(projectRoot, ".lane-manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(resolve(laneRoot, "target/target.json"), `${JSON.stringify(target, null, 2)}\n`, "utf8");
  const installed = resolve(projectRoot, host === "codex" ? ".agents/skills/skill-rails-next" : ".claude/skills/skill-rails-next");
  const built = await run(process.execPath, [resolve(projectRoot, "src/core/cli.mjs"), "build", "--source", manifestPath, "--target", "skill-rails-next", "--out", installed], { cwd: projectRoot });
  if (built.code !== 0) throw new Error(`LANE_BUILD_FAILED:${built.stderr.toString("utf8")}:${built.stdout.toString("utf8")}`);
  return { installed, built, manifestPath };
}

async function setupTask(projectRoot, task) {
  if (task === "product") {
    await mkdir(resolve(projectRoot, "pilot"), { recursive: true });
    await writeFile(resolve(projectRoot, "pilot/product-request.md"), "# Product request\n\nCreate a bookmark CLI for one user. Preserve the phrase `save once, retrieve exactly`. The brief must state the HTTPS-only acceptance boundary. Storage location, retention period, and import support are undecided and must remain unknown.\n", "utf8");
  }
  if (task === "recovery") {
    const sourcePath = resolve(projectRoot, "authoring/skill-rails/SKILL.source.md");
    const source = await readFile(sourcePath, "utf8");
    const changed = source.replace("Use exact IDs and paths.", "Use exact identifiers and paths.");
    if (changed === source) throw new Error("RECOVERY_SOURCE_ANCHOR_MISSING");
    await writeFile(sourcePath, changed, "utf8");
    const generated = resolve(projectRoot, "skills/skill-rails");
    const built = await run(process.execPath, [resolve(projectRoot, "src/core/cli.mjs"), "build", "--source", resolve(projectRoot, "authoring-package.json"), "--target", "skill-rails-next", "--out", generated], { cwd: projectRoot });
    if (built.code !== 0) throw new Error(`RECOVERY_BUILD_FAILED:${built.stdout.toString("utf8")}`);
    const generatedEntry = resolve(generated, "SKILL.md");
    const bytes = await readFile(generatedEntry, "utf8");
    await writeFile(generatedEntry, bytes.replace("Use exact identifiers and paths.", "Use exact IDs and paths."), "utf8");
  }
}

async function walk(root, at = root, rows = new Map()) {
  for (const entry of await readdir(at, { withFileTypes: true })) {
    const path = resolve(at, entry.name);
    const rel = relative(root, path).replaceAll("\\", "/");
    if (rel === ".lane-manifest.json" || [".agents", ".claude", ".lane-source", "node_modules"].some((prefix) => rel === prefix || rel.startsWith(`${prefix}/`))) continue;
    if (entry.isDirectory()) await walk(root, path, rows);
    else if (entry.isFile()) {
      const bytes = await readFile(path);
      rows.set(rel, { bytes: bytes.length, sha256: sha256(bytes), utf8: bytes.length <= 200000 ? bytes.toString("utf8") : null });
    }
  }
  return rows;
}

function diffTrees(before, after) {
  const paths = [...new Set([...before.keys(), ...after.keys()])].sort();
  return paths.filter((path) => before.get(path)?.sha256 !== after.get(path)?.sha256).map((path) => ({ path, before: before.get(path) ?? null, after: after.get(path) ?? null }));
}

function treeHash(rows) {
  const bytes = [...rows].sort(([left], [right]) => left.localeCompare(right)).map(([path, value]) => `${path}\0${value.sha256}\n`).join("");
  return sha256(Buffer.from(bytes, "utf8"));
}

function hostCommand(host, prompt) {
  if (host === "codex") return {
    executable: process.execPath,
    args: [resolve(dirname(process.execPath), "node_modules/@openai/codex/bin/codex.js"), "exec", "--skip-git-repo-check", "--ephemeral", "--ignore-user-config", "--approve-for-me", "--json", "--model", "gpt-5.6-sol", "--config", "model_reasoning_effort=high", "-"],
    input: prompt,
  };
  return {
    executable: "claude",
    args: ["--print", "--output-format", "stream-json", "--verbose", "--no-session-persistence", "--model", "claude-fable-5", "--effort", "high", "--permission-mode", "auto", "--permission-prompts", "none", "--setting-sources", "project"],
    input: prompt,
  };
}

function hostProbeCommand(host) {
  if (host === "codex") {
    const script = resolve(dirname(process.execPath), "node_modules/@openai/codex/bin/codex.js");
    return {
      executable: process.execPath,
      versionArgs: [script, "--version"],
      helpArgs: [script, "exec", "--help"],
      requiredHelp: ["--skip-git-repo-check", "--ephemeral", "--ignore-user-config", "--approve-for-me", "--json", "--model", "--config"],
    };
  }
  return {
    executable: "claude",
    versionArgs: ["--version"],
    helpArgs: ["--help"],
    requiredHelp: ["--print", "--output-format", "--no-session-persistence", "--model", "--effort", "--permission-mode", "--permission-prompts", "--setting-sources"],
  };
}

async function fileLength(path) {
  return (await readFile(path)).length;
}

async function fixtureTestSuite(projectRoot) {
  return run(process.execPath, [resolve(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"), "test"], { cwd: projectRoot });
}

async function preflight(projectRoot, task, host, laneBuild, fixtureTests) {
  const rows = [];
  const requiredByTask = {
    product: ["domains/natural-language-pilot/skill-package.json", "pilot/product-request.md"],
    bounded: ["tests/record.test.mjs", "domains/natural-language-pilot/skill-package.json"],
    recovery: ["authoring-package.json", "skills/skill-rails/.skill-rails-build.json"],
  };
  for (const path of requiredByTask[task]) rows.push({ name: `fixture:${path}`, ok: await exists(resolve(projectRoot, path)), evidence: path });
  rows.push({ name: "harness-self-test-excluded", ok: !await exists(resolve(projectRoot, "tests/framework-harness.test.mjs")), evidence: "tests/framework-harness.test.mjs" });

  const localFramework = await readFile(resolve(projectRoot, "docs/guide/ai-skill-evolution-method_ko.md"));
  const canonicalFramework = await readFile(resolve(repositoryRoot, "docs/guide/ai-skill-evolution-method_ko.md"));
  rows.push({ name: "framework-original-hash", ok: sha256(localFramework) === sha256(canonicalFramework), evidence: sha256(localFramework) });

  const check = await run(process.execPath, [resolve(projectRoot, "src/core/cli.mjs"), "check", "--source", laneBuild.manifestPath, "--target", "skill-rails-next", "--out", laneBuild.installed], { cwd: projectRoot });
  rows.push({ name: "lane-source-current", ok: check.code === 0, evidence: `${check.code}:${check.stdout.toString("utf8").trim()}:${check.stderr.toString("utf8").trim()}` });

  const probe = hostProbeCommand(host);
  const version = await run(probe.executable, probe.versionArgs, { cwd: projectRoot });
  rows.push({ name: "host-version", ok: version.code === 0, evidence: `${version.code}:${version.stdout.toString("utf8").trim()}:${version.stderr.toString("utf8").trim()}` });
  const help = await run(probe.executable, probe.helpArgs, { cwd: projectRoot });
  const helpText = `${help.stdout.toString("utf8")}\n${help.stderr.toString("utf8")}`;
  const missing = probe.requiredHelp.filter((flag) => !helpText.includes(flag));
  rows.push({ name: "host-command-surface", ok: help.code === 0 && missing.length === 0, evidence: missing.length ? `missing:${missing.join(",")}` : `help-exit:${help.code}` });
  rows.push({ name: "fixture-test-suite", ok: fixtureTests.code === 0, evidence: `${fixtureTests.code}:${fixtureTests.stdout.toString("utf8").trim()}:${fixtureTests.stderr.toString("utf8").trim()}` });
  return {
    rows,
    version: version.stdout.toString("utf8").trim() || version.stderr.toString("utf8").trim(),
    currentnessCheckMs: check.wallClockMs,
    preflightRuntimeMs: check.wallClockMs + version.wallClockMs + help.wallClockMs + fixtureTests.wallClockMs,
  };
}

async function laneReadContract(lane, installed) {
  if (lane === "L0") return { laneMandatedBytes: 0, indexBytes: 0, referenceBytes: 0, indexPresent: false };
  const referencePath = resolve(installed, "references/universalFrameworkOriginal.md");
  const indexPath = resolve(installed, "references/universalFrameworkOriginal.index.json");
  const referenceBytes = await fileLength(referencePath);
  const indexBytes = await fileLength(indexPath);
  if (lane === "L2") return { laneMandatedBytes: referenceBytes, indexBytes, referenceBytes, indexPresent: true };
  const index = await json(indexPath);
  const sectionZero = index.sections.find((section) => section.sectionId === "0");
  if (!sectionZero) throw new Error("FRAMEWORK_SECTION_ZERO_MISSING");
  return { laneMandatedBytes: sectionZero.endByte - sectionZero.startByte, indexBytes, referenceBytes, indexPresent: true };
}

function boundedReadObserved(frameworkReads, lane) {
  if (lane === "L0") return "not-applicable";
  const kinds = new Set(frameworkReads.map((read) => read.rangeKind));
  if (kinds.has("bytes")) return "bytes";
  if (kinds.has("lines") || kinds.has("search")) return "lines";
  if (kinds.has("whole")) return "whole-only";
  return "none";
}

function resultTextBytes(content) {
  if (typeof content === "string") return Buffer.byteLength(content, "utf8");
  if (!Array.isArray(content)) return content === undefined || content === null ? 0 : Buffer.byteLength(JSON.stringify(content), "utf8");
  return content.reduce((sum, item) => sum + (typeof item === "string" ? Buffer.byteLength(item, "utf8") : Buffer.byteLength(item?.text ?? JSON.stringify(item), "utf8")), 0);
}

function toolKind(name, input = {}) {
  const normalized = String(name ?? "").toLowerCase();
  const command = String(input.command ?? input.cmd ?? "").toLowerCase();
  if (["grep", "glob", "search"].some((part) => normalized.includes(part)) || /\brg\b|select-string|grep\b/u.test(command)) return "search";
  if (normalized === "read" || normalized.includes("read_file") || /get-content|\bcat\b|\btype\b/u.test(command)) return "read";
  if (normalized.includes("write")) return "write";
  if (normalized.includes("edit") || normalized === "file_change") return "edit";
  if (normalized.includes("bash") || normalized.includes("shell") || normalized === "command_execution") return "shell";
  return "other";
}

function readObservation(name, input, returnedBytes) {
  const material = `${name ?? ""}\n${JSON.stringify(input ?? {})}`.replaceAll("\\", "/").toLowerCase();
  const packageReference = material.includes("references/universalframeworkoriginal.md");
  const repositoryOriginal = material.includes("docs/guide/ai-skill-evolution-method_ko.md");
  if (!packageReference && !repositoryOriginal) return null;
  const normalizedName = String(name ?? "").toLowerCase();
  const command = String(input?.command ?? input?.cmd ?? "").toLowerCase();
  let rangeKind = "unknown";
  if (normalizedName.includes("grep") || /\brg\b|select-string|grep\b/u.test(command)) rangeKind = "search";
  else if (input?.offset !== undefined || input?.limit !== undefined || /\[[0-9]+\.\.[0-9]+\]|-totalcount|-tail|-skip|-first|sed\s+-n|head\b|tail\b/u.test(command)) rangeKind = "lines";
  else if (/byte|startbyte|endbyte/u.test(command)) rangeKind = "bytes";
  else if (normalizedName === "read" || /get-content|\bcat\b|\btype\b/u.test(command)) rangeKind = "whole";
  return { source: packageReference ? "package-reference" : "repository-original", primitive: String(name ?? "unknown"), rangeKind, returnedBytes };
}

function emptyKinds() {
  return { read: 0, search: 0, shell: 0, write: 0, edit: 0, other: 0 };
}

export function transcriptMetrics(host, bytes) {
  const pendingClaudeTools = new Map();
  const seenTools = new Set();
  const seenToolResults = new Set();
  const byKind = emptyKinds();
  const frameworkReads = [];
  let usageRaw = null;
  let claudeTotalCostUsd = null;
  let toolResultBytes = 0;
  let indexReturnedBytes = 0;
  let fallbackToolCalls = 0;

  const recordTool = (id, name, input) => {
    const key = id ?? `${name}:${seenTools.size}`;
    if (seenTools.has(key)) return false;
    seenTools.add(key);
    byKind[toolKind(name, input)] += 1;
    if (`${name ?? ""}\n${JSON.stringify(input ?? {})}`.replaceAll("\\", "/").toLowerCase().includes("fallback")) fallbackToolCalls += 1;
    return true;
  };

  for (const line of bytes.toString("utf8").split(/\r?\n/u)) {
    if (!line) continue;
    let event;
    try { event = JSON.parse(line); } catch { continue; }

    if (host === "codex" && event.type === "item.completed" && ["command_execution", "file_change", "mcp_tool_call"].includes(event.item?.type)) {
      const name = event.item.type;
      const input = { command: event.item.command ?? "" };
      if (recordTool(event.item.id, name, input)) {
        const returnedBytes = resultTextBytes(event.item.aggregated_output);
        toolResultBytes += returnedBytes;
        const observation = readObservation(name, input, returnedBytes);
        if (observation) frameworkReads.push(observation);
        if (`${event.item.command ?? ""}`.replaceAll("\\", "/").toLowerCase().includes("universalframeworkoriginal.index.json")) indexReturnedBytes += returnedBytes;
      }
    }
    if (host === "codex" && event.type === "turn.completed") usageRaw = event.usage ?? null;

    if (host === "claude" && event.type === "assistant") {
      for (const item of event.message?.content ?? []) {
        if (item.type !== "tool_use" || !recordTool(item.id, item.name, item.input)) continue;
        pendingClaudeTools.set(item.id, { name: item.name, input: item.input ?? {} });
      }
    }
    if (host === "claude" && event.type === "user") {
      for (const item of event.message?.content ?? []) {
        if (item.type !== "tool_result") continue;
        if (seenToolResults.has(item.tool_use_id)) continue;
        seenToolResults.add(item.tool_use_id);
        const returnedBytes = resultTextBytes(item.content);
        toolResultBytes += returnedBytes;
        const tool = pendingClaudeTools.get(item.tool_use_id);
        if (!tool) continue;
        const observation = readObservation(tool.name, tool.input, returnedBytes);
        if (observation) frameworkReads.push(observation);
        const material = `${tool.name}\n${JSON.stringify(tool.input)}`.replaceAll("\\", "/").toLowerCase();
        if (material.includes("universalframeworkoriginal.index.json")) indexReturnedBytes += returnedBytes;
      }
    }
    if (host === "claude" && event.type === "result") {
      usageRaw = event.usage ?? null;
      claudeTotalCostUsd = event.total_cost_usd ?? null;
    }
  }

  const claude = host === "claude" && usageRaw ? {
    uncachedInput: usageRaw.input_tokens ?? 0,
    cacheCreate: usageRaw.cache_creation_input_tokens ?? 0,
    cacheRead: usageRaw.cache_read_input_tokens ?? 0,
    output: usageRaw.output_tokens ?? 0,
    thinking: usageRaw.output_tokens_details?.thinking_tokens ?? 0,
  } : null;
  const codex = host === "codex" && usageRaw ? {
    inputTotal: usageRaw.input_tokens ?? 0,
    cachedInput: usageRaw.cached_input_tokens ?? 0,
    output: usageRaw.output_tokens ?? 0,
    reasoning: usageRaw.reasoning_output_tokens ?? 0,
  } : null;
  return {
    usageRaw,
    claudeTotalCostUsd,
    tokens: {
      claude,
      codex,
      billedInputTokens: claude ? claude.uncachedInput + claude.cacheCreate + claude.cacheRead : codex?.inputTotal ?? null,
      comparabilityScope: "same-host-only",
    },
    tools: { count: seenTools.size, byKind, comparabilityScope: "same-host-only" },
    toolResultBytes,
    frameworkReads,
    indexReturnedBytes,
    fallbackToolCalls,
  };
}

async function machineChecks(projectRoot, task) {
  const checks = [];
  const runCheck = async (name, args) => {
    const result = await run(process.execPath, args, { cwd: projectRoot });
    checks.push({ name, exitCode: result.code, wallClockMs: result.wallClockMs, stdout: result.stdout.toString("utf8"), stderr: result.stderr.toString("utf8") });
    return result;
  };
  if (task === "product") {
    await runCheck("build-product-package", [resolve(projectRoot, "src/core/cli.mjs"), "build", "--source", resolve(projectRoot, "domains/natural-language-pilot/skill-package.json"), "--out-root", resolve(projectRoot, "fixture/machine-dist-product")]);
  } else if (task === "bounded") {
    await runCheck("record-targeted-tests", ["--test", resolve(projectRoot, "tests/record.test.mjs")]);
    await runCheck("build-verify", [resolve(projectRoot, "src/core/cli.mjs"), "build", "--source", resolve(projectRoot, "domains/natural-language-pilot/skill-package.json"), "--out-root", resolve(projectRoot, "fixture/machine-dist-verify")]);
  } else {
    await runCheck("authoring-current", [resolve(projectRoot, "src/core/cli.mjs"), "check", "--source", resolve(projectRoot, "authoring-package.json"), "--target", "skill-rails-next", "--out", resolve(projectRoot, "skills/skill-rails")]);
    await runCheck("authoring-intact", [resolve(projectRoot, "src/core/cli.mjs"), "check", "--out", resolve(projectRoot, "skills/skill-rails")]);
  }
  return checks;
}

async function runCell(lane, task, host, seed, protocol, schema) {
  const cellId = `${lane.toLowerCase()}-${task}-${host}-r${protocol.fixtureRevision}-seed${seed}`;
  const receiptPath = resolve(resultsRoot, `${cellId}.json`);
  if (await exists(receiptPath)) {
    process.stdout.write(`${JSON.stringify({ cellId, status: "EXISTS", receiptPath })}\n`);
    return;
  }
  const projectRoot = await mkdtemp(join(tmpdir(), `skill-rails-m5-${cellId}-`));
  process.stdout.write(`${JSON.stringify({ cellId, status: "STARTED", projectRoot })}\n`);
  await copyWorkspace(projectRoot, protocol);
  const fixtureTests = await fixtureTestSuite(projectRoot);
  await setupTask(projectRoot, task);
  const laneBuild = await installLane(projectRoot, lane, host, protocol);
  const { installed } = laneBuild;
  const taskFile = resolve(projectRoot, "fixture/task.md");
  await writeFile(taskFile, `# Raw task\n\n${protocol.tasks[task].rawTask}\n\n# Success condition\n\n${protocol.tasks[task].successCondition}\n`, "utf8");
  const before = await walk(projectRoot);
  const localSkill = relative(projectRoot, resolve(installed, "SKILL.md")).replaceAll("\\", "/");
  const prompt = `${protocol.fixedPrompt}\n\nProject-local skill: ${localSkill}\nRaw task and success condition: fixture/task.md\nLane: ${lane} (${protocol.lanes[lane].frameworkExposure})\nSeed: ${seed}`;
  const invocation = hostCommand(host, prompt);
  const preconditions = await preflight(projectRoot, task, host, laneBuild, fixtureTests);
  const preconditionsPass = preconditions.rows.every((row) => row.ok);
  const startedAt = new Date().toISOString();
  const hostResult = preconditionsPass
    ? await run(invocation.executable, invocation.args, { cwd: projectRoot, input: invocation.input })
    : { code: null, signal: null, wallClockMs: 0, stdout: Buffer.alloc(0), stderr: Buffer.from("ABORTED_PRECONDITION\n", "utf8") };
  const afterHost = await walk(projectRoot);
  const checks = preconditionsPass ? await machineChecks(projectRoot, task) : [];
  const afterChecks = await walk(projectRoot);
  const transcriptDir = resolve(resultsRoot, "raw");
  await mkdir(transcriptDir, { recursive: true });
  const stdoutPath = resolve(transcriptDir, `${cellId}.stdout.jsonl`);
  const stderrPath = resolve(transcriptDir, `${cellId}.stderr.txt`);
  await writeFile(stdoutPath, hostResult.stdout);
  await writeFile(stderrPath, hostResult.stderr);
  const measured = transcriptMetrics(host, hostResult.stdout);
  const entryBytes = await fileLength(resolve(installed, "SKILL.md"));
  const taskBytes = await fileLength(taskFile);
  const readContract = await laneReadContract(lane, installed);
  const promptBytes = Buffer.byteLength(prompt, "utf8");
  const fixedReadBytes = promptBytes + entryBytes + taskBytes + readContract.laneMandatedBytes;
  const frameworkBytesReadApprox = measured.frameworkReads.reduce((sum, read) => sum + read.returnedBytes, 0);
  const installedEntry = await readFile(resolve(installed, "SKILL.md"), "utf8");
  const machineRuntimeMs = checks.reduce((sum, check) => sum + check.wallClockMs, 0);
  const validity = !preconditionsPass
    ? { status: "aborted-precondition", reason: preconditions.rows.filter((row) => !row.ok).map((row) => row.name).join(",") }
    : hostResult.code !== 0 && measured.tools.count === 0
      ? { status: "harness-defect", reason: `Host exited ${hostResult.code} before any observable tool call.` }
      : { status: "valid", reason: null };
  const deliveryStatus = !preconditionsPass ? "not-run" : hostResult.code === 0 && checks.length > 0 && checks.every((check) => check.exitCode === 0) ? "pass" : "fail";
  const receipt = {
    schemaVersion: 2,
    protocolId: protocol.protocolId,
    fixtureRevision: protocol.fixtureRevision,
    cellId,
    lane,
    task,
    host,
    seed,
    projectRoot,
    startedAt,
    protocolSha256: sha256(await readFile(protocolPath)),
    workspace: { copiedEntries: protocol.fixture.copiedEntries, excludedEntries: protocol.fixture.excludedEntries, preconditions: preconditions.rows, treeSha256Before: treeHash(before) },
    hostIdentity: {
      name: host,
      model: protocol.hosts[host].model,
      version: preconditions.version,
      effort: protocol.hosts[host].effort,
      permission: protocol.hosts[host].permission,
      freshness: protocol.hosts[host].freshness,
    },
    command: [invocation.executable, ...invocation.args],
    hostResult: { exitCode: hostResult.code, signal: hostResult.signal, wallClockMs: hostResult.wallClockMs },
    transcript: {
      stdoutPath: relative(repositoryRoot, stdoutPath).replaceAll("\\", "/"), stdoutBytes: hostResult.stdout.length, stdoutSha256: sha256(hostResult.stdout),
      stderrPath: relative(repositoryRoot, stderrPath).replaceAll("\\", "/"), stderrBytes: hostResult.stderr.length, stderrSha256: sha256(hostResult.stderr),
    },
    usageRaw: measured.usageRaw,
    cost: { claudeTotalCostUsd: measured.claudeTotalCostUsd },
    tokens: measured.tokens,
    reads: {
      promptBytes,
      entryBytes,
      taskBytes,
      laneMandatedBytes: readContract.laneMandatedBytes,
      fixedReadBytes,
      toolResultBytes: measured.toolResultBytes,
      frameworkBytesReadApprox,
      conditionalReadBytesApprox: Math.max(0, frameworkBytesReadApprox - readContract.laneMandatedBytes),
      frameworkReadSourceLeak: measured.frameworkReads.some((read) => read.source === "repository-original"),
      frameworkReads: measured.frameworkReads,
    },
    index: {
      present: readContract.indexPresent,
      bytes: readContract.indexBytes,
      namedInEntry: installedEntry.includes("universalFrameworkOriginal.index.json"),
      consulted: measured.indexReturnedBytes > 0,
      returnedBytes: measured.indexReturnedBytes,
      boundedReadObserved: boundedReadObserved(measured.frameworkReads, lane),
    },
    artifactMaintenance: {
      laneBuildMs: laneBuild.built.wallClockMs,
      generatedReferenceBytes: readContract.referenceBytes,
      generatedIndexBytes: readContract.indexBytes,
      currentnessCheckMs: preconditions.currentnessCheckMs,
      afterMachineCheckChangeCount: diffTrees(afterHost, afterChecks).length,
      indexMaintenanceCost: null,
    },
    tools: measured.tools,
    execution: {
      userRoundtrips: 0,
      wallClockMs: hostResult.wallClockMs,
      preflightRuntimeMs: preconditions.preflightRuntimeMs,
      machineRuntimeMs,
      fallbackToolCalls: measured.fallbackToolCalls,
    },
    changes: diffTrees(before, afterHost),
    machineChecks: checks,
    validity,
    delivery: {
      status: deliveryStatus,
      evidence: deliveryStatus === "not-run"
        ? preconditions.rows.filter((row) => !row.ok).map((row) => `precondition:${row.name}`)
        : [`host-exit:${hostResult.code}`, ...checks.map((check) => `machine-check:${check.name}:exit-${check.exitCode}`)],
    },
    linkedEvaluation: {
      semanticReviewReceiptPath: relative(repositoryRoot, resolve(resultsRoot, "reviews", `${cellId}.json`)).replaceAll("\\", "/"),
      usingAiReceiptPath: relative(repositoryRoot, resolve(resultsRoot, "using-ai", `${cellId}.json`)).replaceAll("\\", "/"),
    },
    claimPolicy: "Machine checks establish delivery or structural safety only. Framework benefit, semantic quality, fresh behavior, and actual effect remain unproven until transcript and changed artifacts are independently reviewed.",
  };
  const errors = validateJsonSchema(receipt, schema);
  if (errors.length) throw new Error(`RECEIPT_INVALID:${errors.join("|")}`);
  await mkdir(dirname(receiptPath), { recursive: true });
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ cellId, status: "CAPTURED", validity: validity.status, hostExitCode: hostResult.code, receiptPath, deliveryPass: checks.length > 0 && checks.every((check) => check.exitCode === 0) })}\n`);
}

async function classifyV1() {
  const defects = new Map([
    ["l0-recovery-codex-seed1", "The Codex CLI rejected --approve-for-me before any AI tool call."],
    ["l0-recovery-codex-seed2", "The Codex CLI rejected the incompatible approval and sandbox arguments before any AI tool call."],
    ["l0-bounded-codex-seed3", "The isolated workspace omitted tests/record.test.mjs, so the fixed bounded check could not run."],
    ["l0-bounded-claude-seed3", "The isolated workspace omitted tests/record.test.mjs, so the fixed bounded check could not run."],
  ]);
  const entries = [];
  const names = (await readdir(resultsBaseRoot)).filter((name) => /^l[0-2]-(product|bounded|recovery)-(codex|claude)-seed[0-9]+\.json$/u.test(name)).sort();
  for (const name of names) {
    const receipt = await json(resolve(resultsBaseRoot, name));
    if (receipt.protocolId !== "m5-framework-lanes-v1") continue;
    const cellId = name.slice(0, -5);
    const defect = defects.get(cellId);
    entries.push({
      cellId,
      classification: defect ? "harness-defect" : "superseded-by-protocol-v2",
      reason: defect ?? "The entry, fixture, preconditions, and cost accounting changed under protocol v2, so this cell is pre-gate evidence only.",
      receiptPath: relative(repositoryRoot, resolve(resultsBaseRoot, name)).replaceAll("\\", "/"),
      stdoutPath: receipt.transcript.stdoutPath,
      stderrPath: receipt.transcript.stderrPath,
    });
  }
  const classification = {
    schemaVersion: 1,
    classificationId: "m5-framework-v1-preflight-classification",
    protocolId: "m5-framework-lanes-v1",
    replacementProtocolId: "m5-framework-lanes-v2",
    entries,
    claimPolicy: "Protocol-v1 cells are pre-gate evidence only. Harness defects are not AI failures, and every other v1 cell is non-comparable with protocol v2.",
  };
  const schema = await json(classificationSchemaPath);
  const errors = validateJsonSchema(classification, schema);
  if (errors.length) throw new Error(`CLASSIFICATION_INVALID:${errors.join("|")}`);
  const output = resolve(resultsBaseRoot, "v1-classification.json");
  await writeFile(output, `${JSON.stringify(classification, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({
    status: "CLASSIFIED_V1",
    output,
    count: entries.length,
    harnessDefects: entries.filter((entry) => entry.classification === "harness-defect").length,
  })}\n`);
}

async function runPreflightOnly(lane, task, host, protocol) {
  const projectRoot = await mkdtemp(join(tmpdir(), `skill-rails-m5-preflight-${lane.toLowerCase()}-${task}-${host}-`));
  await copyWorkspace(projectRoot, protocol);
  const fixtureTests = await fixtureTestSuite(projectRoot);
  await setupTask(projectRoot, task);
  const laneBuild = await installLane(projectRoot, lane, host, protocol);
  const result = await preflight(projectRoot, task, host, laneBuild, fixtureTests);
  process.stdout.write(`${JSON.stringify({
    status: result.rows.every((row) => row.ok) ? "PREFLIGHT_PASS" : "PREFLIGHT_FAIL",
    lane,
    task,
    host,
    projectRoot,
    hostVersion: result.version,
    preconditions: result.rows,
  })}\n`);
}

async function main() {
  const [action, ...args] = process.argv.slice(2);
  const options = parseArguments(args);
  if (action === "classify-v1") {
    await classifyV1();
    return;
  }
  const protocol = await json(protocolPath);
  const schema = await json(receiptSchemaPath);
  if (action === "preflight") {
    await runPreflightOnly(options.lane, options.task, options.host, protocol);
    return;
  }
  if (action === "cell") {
    await runCell(options.lane, options.task, options.host, Number(options.seed ?? 1), protocol, schema);
    return;
  }
  if (action !== "matrix") throw new Error("Usage: framework-harness.mjs cell --lane L0 --task product --host codex --seed 1 | matrix --concurrency 2");
  const cells = [];
  const seed = Number(options.seed ?? 1);
  const lanes = options.lanes ? options.lanes.split(",") : Object.keys(protocol.lanes);
  const tasks = options.tasks ? options.tasks.split(",") : Object.keys(protocol.tasks);
  const hosts = options.hosts ? options.hosts.split(",") : Object.keys(protocol.hosts);
  for (const lane of lanes) for (const task of tasks) for (const host of hosts) cells.push({ lane, task, host, seed });
  const concurrency = Number(options.concurrency ?? 2);
  let cursor = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (cursor < cells.length) {
      const cell = cells[cursor];
      cursor += 1;
      await runCell(cell.lane, cell.task, cell.host, cell.seed, protocol, schema);
    }
  });
  await Promise.all(workers);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
