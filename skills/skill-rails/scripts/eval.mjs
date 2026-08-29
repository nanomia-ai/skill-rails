#!/usr/bin/env node
import { mkdir, readFile, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { parseArgs } from "./lib/args.mjs";
import { copyTree, isInside, readJson, writeJsonAtomic } from "./lib/io.mjs";
import { exists } from "./lib/io.mjs";
import { lintSimpleSkill } from "./lib/simple-lint.mjs";
import { measureSimpleContextSurface } from "./lib/context-surface.mjs";

const execFileAsync = promisify(execFile);

try {
  const args = parseArgs(process.argv.slice(2), { booleans: ["json", "write-report"], values: ["skill", "repeats", "suite-root"] });
  const skillRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
  const suiteRoot = resolve(args["suite-root"] ?? skillRoot);
  const report = args.skill ? await evaluateSkill(resolve(args.skill), Number(args.repeats ?? 200)) : await evaluateG05(suiteRoot);
  if (args["write-report"]) await writeJsonAtomic(join(suiteRoot, "evals", "latest-report.json"), report);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.ok ? 0 : 1;
} catch (error) {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exitCode = 1;
}

async function evaluateSkill(root, repeats) {
  if (!(await exists(join(root, "spec.mjs")))) return evaluateSimpleSkill(root);
  const [{ runFixtureSuite }, { validateFull }] = await Promise.all([import("./lib/build-core.mjs"), import("./runtime/validator.mjs")]);
  const validation = await validateFull(root);
  if (!validation.ok) return { schema: "skill-rails/eval-report/1", ok: false, target: root, structural: validation, behavior: null, claim: "invalid" };
  const behavior = await runFixtureSuite(root, { repeats });
  const deferred = validation.spec.DEFERRED?.length ?? 0;
  return {
    schema: "skill-rails/eval-report/1", ok: deferred === 0, target: root,
    structural: { ok: true, checks: validation.checks }, behavior,
    release_readiness: deferred === 0 ? "deterministic-fixtures-passed" : "review-required",
    caveat: deferred === 0 ? "Model trigger, long-session drift, and task-output evaluation still require forward runs." : `${deferred} DEFERRED item(s) remain; structural validity is not semantic completion.`
  };
}

async function evaluateSimpleSkill(root) {
  const creator = await isCreatorPackage(root);
  const validation = await lintSimpleSkill(root, { creatorBudgets: creator });
  if (!validation.ok) return { schema: "skill-rails/eval-report/1", ok: false, target: root, structural: validation, behavior: null, release_readiness: "invalid", claim: "invalid" };
  const profileDecision = await optionalJson(join(root, ".skill-rails", "profile-decision.json"));
  const cases = await optionalJson(join(root, ".skill-rails", "eval-cases.json")) ?? [];
  const ledger = await optionalJson(join(root, ".skill-rails", "obligation-ledger.json"));
  const profile = profileDecision?.profile ?? (creator ? "p1" : "unknown");
  const contextSurface = await measureSimpleContextSurface(root);
  let scaffold = false;
  if (!creator && profile === "p1") {
    const helper = await readFile(join(root, "scripts", "run.mjs"), "utf8");
    scaffold = helper.includes("@skill-rails scaffold") || helper.includes("SR_P1_SCAFFOLD");
  }
  const openObligations = Array.isArray(ledger?.atoms) ? ledger.atoms.filter((atom) => atom.disposition === "review-required").length : 0;
  const releaseReadiness = scaffold
    ? "helper-implementation-required"
    : openObligations > 0
    ? "authoring-obligations-required"
    : creator
    ? "creator-forward-test-required"
    : "forward-test-required";
  return {
    schema: "skill-rails/eval-report/1",
    ok: false,
    target: root,
    profile,
    kind: creator ? "creator" : "generated-skill",
    structural: { ok: true, level: validation.level },
    context_surface: contextSurface,
    behavior: { status: "unproven", cases: cases.length, scaffold, open_obligations: openObligations },
    release_readiness: releaseReadiness,
    caveat: creator
      ? "Creator structure passed. Profile selection, generated-package quality, platform discovery, and cold-agent use still require forward runs."
      : scaffold
      ? "The generated P1 helper is a fail-closed scaffold. Implement it and add golden tests before forward evaluation."
      : openObligations > 0
      ? `${openObligations} authoring obligation(s) remain review-required; structural validity is not semantic completion.`
      : "Structural validity is not behavior evidence. Run the recorded positive and near-miss cases with fresh Codex and Claude sessions."
  };
}

async function isCreatorPackage(root) {
  const scripts = ["init.mjs", "migrate.mjs", "maintain.mjs", "lint.mjs", "build.mjs", "eval.mjs"];
  const present = await Promise.all(scripts.map((name) => exists(join(root, "scripts", name))));
  return present.every(Boolean);
}

async function evaluateG05(projectRoot) {
  const [{ materializeRuntime }, { semanticDiff, snapshotContract }, { validateFull }] = await Promise.all([
    import("./lib/build-core.mjs"), import("./lib/semantic-diff.mjs"), import("./runtime/validator.mjs")
  ]);
  const base = join(projectRoot, "evals", "g0_5");
  const scratch = join(projectRoot, ".skill-rails", "eval-runs", `g0.5-${randomUUID()}`);
  const clean = join(scratch, "clean");
  const mutated = join(scratch, "mutated");
  if (!isInside(join(projectRoot, ".skill-rails"), scratch)) throw new Error(`Unsafe evaluation scratch path: ${scratch}`);
  await mkdir(scratch, { recursive: true });
  try {
    await Promise.all([
      copyTree(join(base, "b-v5-clean"), clean, { filter: (local) => !local.startsWith("scripts/skill-rails") }),
      copyTree(join(base, "b-v5-mutated-v3"), mutated, { filter: (local) => !local.startsWith("scripts/skill-rails") })
    ]);
    await Promise.all([materializeRuntime(clean), materializeRuntime(mutated)]);
    const [cleanValidation, mutatedValidation, before, after, oracle, protocol, thresholds] = await Promise.all([
      validateFull(clean), validateFull(mutated), snapshotContract(clean), snapshotContract(mutated),
      readJson(join(base, "v3-oracle.json")), readJson(join(base, "v3-protocol.json")), readJson(join(projectRoot, "evals", "g0", "thresholds.json"))
    ]);
    const difference = semanticDiff(before, after);
    const fixtureProbe = await compareFixtures(clean, mutated);
    const deterministicFindings = mapSeededDefects(oracle, difference, mutatedValidation, fixtureProbe, await readFile(join(clean, "spec.mjs"), "utf8"), await readFile(join(mutated, "spec.mjs"), "utf8"));
    const detected = deterministicFindings.filter((item) => item.detected).length;
    const empirical = await scoreFrozenEmpiricalGate(projectRoot);
    return {
      schema: "skill-rails/g0.5-report/1",
      ok: cleanValidation.ok && detected === oracle.seeded_defects.length && empirical.ok,
      scope: "deterministic-preflight-and-frozen-v3-empirical",
      clean_control: { valid: cleanValidation.ok, diagnostics: cleanValidation.diagnostics },
      mutated: { valid: mutatedValidation.ok, diagnostics: mutatedValidation.diagnostics },
      fixture_probe: fixtureProbe,
      semantic_diff: difference.groups,
      seeded_defects: { detected, total: oracle.seeded_defects.length, ratio: detected / oracle.seeded_defects.length, findings: deterministicFindings },
      empirical_gate: {
        status: empirical.ok ? "passed" : "failed",
        protocol: empirical.protocol,
        protocol_fingerprint: empirical.protocol_fingerprint,
        required_runs: protocol.reviewers.total,
        metrics: empirical.metrics,
        checks: empirical.checks,
        stop_product_hypothesis: empirical.stop_product_hypothesis,
        stop_rule: thresholds.g0_5.stop_rule,
        note: "Fresh Codex and Claude review artifacts, frozen coordinates, state answers, and coordinator-owned forbidden-effect transcripts were re-scored by the frozen v3 scorer."
      }
    };
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

async function scoreFrozenEmpiricalGate(projectRoot) {
  const scorer = join(projectRoot, "scripts", "lib", "g05-score-v3.mjs");
  const { stdout } = await execFileAsync(process.execPath, [scorer], {
    cwd: projectRoot,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, SKILL_RAILS_SUITE_ROOT: projectRoot }
  });
  const report = JSON.parse(stdout);
  if (report.schema !== "skill-rails/g0.5-empirical-report/3") throw new Error(`Unexpected G0.5 empirical report schema: ${report.schema}`);
  return report;
}

async function compareFixtures(clean, mutated) {
  const fixtures = await readJson(join(clean, "fixtures", "scenarios.json"));
  const results = [];
  for (const fixture of fixtures) {
    const cleanOutput = await captureSimulation(clean, fixture);
    const mutatedOutput = await captureSimulation(mutated, fixture);
    results.push({ id: fixture.id, clean: cleanOutput, mutated: mutatedOutput, diverged: JSON.stringify(cleanOutput) !== JSON.stringify(mutatedOutput) });
  }
  return { total: results.length, divergences: results.filter((item) => item.diverged).length, results };
}

async function optionalJson(path) {
  if (!(await exists(path))) return null;
  return readJson(path);
}

async function captureSimulation(root, fixture) {
  try {
    const { simulateSkill } = await import("./runtime/api.mjs");
    const { decision } = await simulateSkill({ skillRoot: root, fixture, runtimeDir: join(root, "scripts", "skill-rails") });
    return { status: decision.status, stage: decision.stage, row: decision.row, effects: decision.effects.map((item) => Array.isArray(item) ? item[0] : item) };
  } catch (error) { return { error: error.code ?? error.message }; }
}

function mapSeededDefects(oracle, diff, validation, fixtureProbe, cleanSource, mutatedSource) {
  const diagnostics = new Set(validation.diagnostics.map((item) => item.code));
  const table = diff.groups.tables.find((item) => item.id === "review");
  const artifact = diff.groups.artifacts.find((item) => item.id === "reviewLog");
  const format = diff.groups.formats.find((item) => item.id === "reviewResult");
  const openChanged = lineSlice(cleanSource, "    open:") !== lineSlice(mutatedSource, "    open:");
  const evidence = {
    D1: openChanged && fixtureProbe.results.some((item) => item.id === "review-open" && item.diverged),
    D2: diagnostics.has("L5") && Boolean(table?.before?.rows?.some((row) => row.state === "BLOCK:review-unclassified")) && !table?.after?.rows?.some((row) => row.state === "BLOCK:review-unclassified"),
    D3: Boolean(table) && table.before.rows.map((row) => row.state).join("|") !== table.after.rows.map((row) => row.state).join("|"),
    D4: diagnostics.has("L10") && Boolean(artifact) && artifact.before.readers?.length > 0 && artifact.after.readers?.length === 0,
    D5: Boolean(format) && Object.keys(format.before.fields ?? {}).length > Object.keys(format.after.fields ?? {}).length
  };
  return oracle.seeded_defects.map((defect) => {
    const id = typeof defect === "string" ? defect : defect.id;
    return { ...(typeof defect === "string" ? { id } : defect), detected: Boolean(evidence[id]), detector: detector(id) };
  });
}

function lineSlice(source, marker) {
  const at = source.indexOf(marker);
  return at < 0 ? null : source.slice(at, source.indexOf("\n", at));
}
function detector(id) { return ({ D1: "fixture divergence + branch-plan source delta", D2: "L5 + semantic row removal", D3: "stable row-order semantic diff", D4: "L10 + artifact readers diff", D5: "format field semantic diff" })[id]; }
