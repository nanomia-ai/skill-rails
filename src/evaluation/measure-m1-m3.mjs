#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFile, cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outputArgument = process.argv[2];
if (!outputArgument) throw new Error("Usage: measure-m1-m3.mjs <receipt-path>");
const outputPath = resolve(outputArgument);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const milestoneFiles = {
  M1: [
    "contracts/source-package.schema.json", "contracts/target.schema.json", "contracts/build-receipt.schema.json",
    "src/core/errors.mjs", "src/core/canonicalize.mjs", "src/core/paths.mjs", "src/core/validate.mjs",
    "src/core/build.mjs", "src/core/check.mjs", "src/core/inspect.mjs", "src/core/cli.mjs",
    "src/runtime/common.mjs", "src/runtime/integrity.mjs", "src/runtime/run-check.mjs",
    "authoring-package.json", "authoring/skill-rails/SKILL.source.md", "authoring/skill-rails/targets/authoring/target.json",
  ],
  M2: [
    "contracts/packet-kernel.schema.json", "contracts/observed-facts.schema.json", "contracts/prepared-work.schema.json",
    "src/runtime/prepare.mjs", "src/runtime/run.mjs",
    "domains/natural-language-pilot/skill-package.json", "domains/natural-language-pilot/modules/purpose.md",
    "domains/natural-language-pilot/modules/verify-baseline.md", "domains/natural-language-pilot/targets/verify/target.json",
    "domains/natural-language-pilot/targets/verify/entry.md", "domains/natural-language-pilot/targets/verify/packet.json",
    "domains/natural-language-pilot/targets/verify/config.json", "domains/natural-language-pilot/targets/verify/config.schema.json",
    "domains/natural-language-pilot/targets/verify/observer.mjs",
  ],
  M3: [
    "src/runtime/record.mjs", "domains/natural-language-pilot/targets/verify/renderer.mjs",
    "domains/natural-language-pilot/targets/verify/contracts/semantic-answer.verify.schema.json",
  ],
};

async function measureFiles(paths) {
  const rows = [];
  for (const logicalPath of paths) {
    const bytes = await readFile(resolve(repositoryRoot, logicalPath));
    rows.push({ path: logicalPath, bytes: bytes.length, sha256: sha256(bytes) });
  }
  return { files: rows.length, bytes: rows.reduce((sum, row) => sum + row.bytes, 0), rows };
}

async function measureTree(root, predicate = () => true, current = root) {
  const rows = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const path = join(current, entry.name);
    if (entry.isDirectory()) rows.push(...(await measureTree(root, predicate, path)).rows);
    else if (entry.isFile()) {
      const logicalPath = relative(root, path).replaceAll("\\", "/");
      if (predicate(logicalPath)) {
        const bytes = await readFile(path);
        rows.push({ path: logicalPath, bytes: bytes.length, sha256: sha256(bytes) });
      }
    }
  }
  rows.sort((left, right) => left.path.localeCompare(right.path, "en"));
  return { files: rows.length, bytes: rows.reduce((sum, row) => sum + row.bytes, 0), rows };
}

function invoke(args, cwd = repositoryRoot) {
  const started = performance.now();
  const result = spawnSync(process.execPath, args, { cwd, encoding: "utf8", windowsHide: true });
  const wallClockMs = Number((performance.now() - started).toFixed(3));
  const lines = result.stdout.trim().split(/\r?\n/u).filter(Boolean);
  let json = null;
  try { json = JSON.parse(lines.at(-1)); } catch {}
  if (result.status !== 0 && !json) throw new Error("PROCESS_FAILED:" + args.join(" ") + ":" + (result.stderr || result.stdout));
  return { exitCode: result.status, wallClockMs, json };
}

async function observe(path) {
  const bytes = await readFile(path);
  return { bytes: bytes.length, sha256: sha256(bytes) };
}

const work = await mkdtemp(join(tmpdir(), "skill-rails-next-m1-m3-cost-"));
try {
  const buildTimes = [];
  let targetRoot;
  for (let index = 0; index < 3; index += 1) {
    const outRoot = resolve(work, "build-" + index);
    const built = invoke(["src/core/cli.mjs", "build", "--source", "domains/natural-language-pilot/skill-package.json", "--out-root", outRoot]);
    buildTimes.push(built.wallClockMs);
    targetRoot = resolve(outRoot, "skills/natural-language-pilot-verify-next");
  }

  async function project(name) {
    const root = resolve(work, name);
    await cp(resolve(repositoryRoot, "fixtures/verify-v1/project"), root, { recursive: true });
    return root;
  }
  const answer = {
    schemaVersion: 1,
    cardId: "bookmark-storage",
    verdict: "unproven",
    summary: "Machine cost fixture does not make an AI behavior claim.",
    checks: [{ name: "machine-cost-only", outcome: "unproven", evidence: [] }],
    unknowns: ["No fresh agent evaluated this synthetic answer."],
  };
  async function prepared(name) {
    const projectRoot = await project(name);
    const result = invoke([resolve(targetRoot, "scripts/run.mjs"), "prepare", "--project", projectRoot], projectRoot);
    if (result.json?.status !== "PREPARED") throw new Error("PREPARE_UNEXPECTED:" + JSON.stringify(result.json));
    await writeFile(result.json.answer, JSON.stringify(answer) + "\n", "utf8");
    return { projectRoot, exchange: dirname(result.json.answer), prepareMs: result.wallClockMs };
  }

  const ordinary = await prepared("ordinary");
  const record = invoke([resolve(targetRoot, "scripts/run.mjs"), "record", "--exchange", ordinary.exchange], ordinary.projectRoot);
  const retry = invoke([resolve(targetRoot, "scripts/run.mjs"), "record", "--exchange", ordinary.exchange], ordinary.projectRoot);

  const staleCase = await prepared("stale");
  await appendFile(resolve(staleCase.projectRoot, "pilot/plan.md"), "\nMachine cost stale mutation.\n", "utf8");
  const staleOutputBefore = await observe(resolve(staleCase.projectRoot, "pilot/verification.md"));
  const stale = invoke([resolve(targetRoot, "scripts/run.mjs"), "record", "--exchange", staleCase.exchange], staleCase.projectRoot);
  const staleOutputAfter = await observe(resolve(staleCase.projectRoot, "pilot/verification.md"));

  const conflictCase = await prepared("conflict");
  await appendFile(resolve(conflictCase.projectRoot, "pilot/verification.md"), "\nMachine cost output mutation.\n", "utf8");
  const conflictOutputBefore = await observe(resolve(conflictCase.projectRoot, "pilot/verification.md"));
  const conflict = invoke([resolve(targetRoot, "scripts/run.mjs"), "record", "--exchange", conflictCase.exchange], conflictCase.projectRoot);
  const conflictOutputAfter = await observe(resolve(conflictCase.projectRoot, "pilot/verification.md"));

  const implementation = {};
  for (const [milestone, paths] of Object.entries(milestoneFiles)) implementation[milestone] = await measureFiles(paths);
  const authoringGenerated = await measureTree(resolve(repositoryRoot, "skills/skill-rails"));
  const pilotGenerated = await measureTree(targetRoot);
  const pilotRuntime = await measureTree(targetRoot, (path) => path.startsWith("scripts/") || path.startsWith("contracts/"));
  const receipt = {
    schemaVersion: 1,
    status: "observed-machine-cost-not-economic-win",
    measuredAt: new Date().toISOString(),
    node: process.version,
    implementation,
    generated: {
      authoringTarget: { files: authoringGenerated.files, bytes: authoringGenerated.bytes },
      pilotTarget: { files: pilotGenerated.files, bytes: pilotGenerated.bytes },
      pilotRuntimeAndContracts: { files: pilotRuntime.files, bytes: pilotRuntime.bytes },
    },
    machineRuntime: {
      buildMs: buildTimes,
      prepareMs: [ordinary.prepareMs, staleCase.prepareMs, conflictCase.prepareMs],
      recordApplied: { wallClockMs: record.wallClockMs, status: record.json?.status },
      recordRetry: { wallClockMs: retry.wallClockMs, status: retry.json?.status },
      inputStale: { wallClockMs: stale.wallClockMs, status: stale.json?.status, code: stale.json?.code, wroteOutput: staleOutputBefore.sha256 !== staleOutputAfter.sha256, outputBefore: staleOutputBefore, outputAfter: staleOutputAfter },
      outputConflict: { wallClockMs: conflict.wallClockMs, status: conflict.json?.status, code: conflict.json?.code, wroteOutput: conflictOutputBefore.sha256 !== conflictOutputAfter.sha256, outputBefore: conflictOutputBefore, outputAfter: conflictOutputAfter },
    },
    errorRecoveryCost: {
      inputStaleRequiresFreshPrepareAndReevaluation: true,
      outputConflictRequiresFreshPrepareAndReevaluation: true,
      appliedAlreadyRequiresNoWrite: true,
      freshAgentCost: null,
    },
    claimPolicy: "Counts and local process timings are observed for these exact files and this host. They do not prove fresh-agent behavior, semantic correctness, cross-host performance, or an economic win.",
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(receipt, null, 2) + "\n", "utf8");
  process.stdout.write(JSON.stringify({ outputPath, buildMs: buildTimes, statuses: receipt.machineRuntime }) + "\n");
} finally {
  const resolvedWork = resolve(work);
  const resolvedTemp = resolve(tmpdir());
  const contained = resolvedWork.startsWith(resolvedTemp + "\\") || resolvedWork.startsWith(resolvedTemp + "/");
  if (!contained) throw new Error("TEMP_PATH_INVALID:" + resolvedWork);
  await rm(resolvedWork, { recursive: true, force: true });
}
