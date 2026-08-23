#!/usr/bin/env node
import { mkdir, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, requireArg } from "./args.mjs";
import { copyTree, isInside } from "./io.mjs";
import { materializeRuntime } from "./build-core.mjs";
import { validateFull } from "../runtime/validator.mjs";

let scratch = null;
try {
  const args = parseArgs(process.argv.slice(2), { values: ["skill"] });
  const projectRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
  const target = resolve(requireArg(args, "skill"));
  const allowedRoot = join(projectRoot, "evals", "g0_5");
  const local = relative(allowedRoot, target).replace(/\\/g, "/");
  if (!isInside(allowedRoot, target) || local !== "b-v5-mutated-v3") throw new Error("The blinded lint harness accepts only the frozen G0.5 v3 B artifact.");
  scratch = join(projectRoot, ".skill-rails", "g0.5-review-lint", randomUUID());
  if (!isInside(join(projectRoot, ".skill-rails"), scratch)) throw new Error("Unsafe review-lint scratch path.");
  await mkdir(scratch, { recursive: true });
  await copyTree(target, scratch, { filter: (path) => !path.startsWith("scripts/skill-rails/") });
  await materializeRuntime(scratch);
  const result = await validateFull(scratch);
  const report = {
    schema: "skill-rails/g0.5-blinded-lint/1",
    ok: result.ok,
    target: local,
    diagnostics: result.diagnostics.map(({ code, pointer, message }) => ({ code, pointer: sanitize(pointer, scratch), message })),
    checks: result.checks
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.ok ? 0 : 1;
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
} finally {
  if (scratch) await rm(scratch, { recursive: true, force: true });
}

function sanitize(pointer, scratchRoot) {
  return typeof pointer === "string" ? pointer.replaceAll(scratchRoot, "<blinded-b-artifact>") : pointer;
}
