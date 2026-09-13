#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const realNode = process.env.SKILL_RAILS_EVAL_REAL_NODE;
const projectRoot = process.env.SKILL_RAILS_EVAL_PROJECT_ROOT;
if (!realNode || !projectRoot) throw new Error("RESPONSE_LOSS_PROXY_ENV_MISSING");

const args = process.argv.slice(2);
const entry = args[0]?.replaceAll("\\", "/");
const isRecord = entry?.endsWith("/scripts/run.mjs") && args[1] === "record";
const statePath = resolve(projectRoot, ".skill-rails-next/evaluation-response-loss.json");

if (!isRecord) {
  const result = spawnSync(realNode, args, { stdio: "inherit", windowsHide: true });
  process.exitCode = result.status ?? 1;
} else {
  let alreadyLost = false;
  try {
    alreadyLost = JSON.parse(readFileSync(statePath, "utf8")).lost === true;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  if (alreadyLost) {
    const result = spawnSync(realNode, args, { stdio: "inherit", windowsHide: true });
    process.exitCode = result.status ?? 1;
  } else {
    const result = spawnSync(realNode, args, { encoding: null, windowsHide: true });
    if (result.status !== 0) {
      if (result.stdout) process.stdout.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
      process.exitCode = result.status ?? 1;
    } else {
      const stdout = result.stdout ?? Buffer.alloc(0);
      const parsed = JSON.parse(stdout.toString("utf8"));
      if (parsed.status !== "APPLIED") {
        process.stdout.write(stdout);
        if (result.stderr) process.stderr.write(result.stderr);
      } else {
        writeFileSync(statePath, `${JSON.stringify({
          schemaVersion: 1,
          lost: true,
          actualStatus: parsed.status,
          actualOutputSha256: parsed.sha256,
          swallowedStdoutBytes: stdout.length,
          swallowedStdoutSha256: createHash("sha256").update(stdout).digest("hex"),
        }, null, 2)}\n`, "utf8");
        process.stderr.write("EVALUATION_RESPONSE_LOST_AFTER_APPLY\n");
        process.exitCode = 86;
      }
    }
  }
}
