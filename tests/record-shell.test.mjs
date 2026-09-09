import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { runInitialDecision, realStatePaths } from "../fixtures/next-core-single-skill-pilot/real-state/e2e-host.mjs";
import { alignDecision } from "../skills/skill-rails/scripts/runtime/alignment.mjs";
import { readTrace } from "../skills/skill-rails/scripts/runtime/trace-core.mjs";
import { makeTestDir, removeTestDir, ROOT } from "./helpers.mjs";

test("generated record transport crosses the supported host shell without inline JSON", async (t) => {
  const base = await makeTestDir("record-shell");
  t.after(() => removeTestDir(base));
  const staged = await runInitialDecision(base, { channel: "available" });
  assert.equal(staged.initial.decision.stage, "acquire");
  const dataDir = join(staged.traceDir, "record data 한글's");
  const dataPath = join(dataDir, "claim.json");
  const expected = { message_id: "msg_$;\\\"한글", note: "line one\nline two" };
  await mkdir(dataDir, { recursive: true });
  await writeFile(dataPath, `\ufeff${JSON.stringify(expected)}`, "utf8");

  const args = [process.execPath, realStatePaths.runPath, "record", "--skill", realStatePaths.skillRoot, "--decision", staged.stagePath, "--type", "effect_claimed", "--effect", "0", "--data-file", dataPath, "--json"];
  const quoted = args.map((value) => process.platform === "win32"
    ? `'${String(value).replaceAll("'", "''")}'`
    : `'${String(value).replaceAll("'", `'"'"'`)}'`).join(" ");
  const child = process.platform === "win32"
    ? spawnSync("powershell.exe", ["-NoProfile", "-Command", `& ${quoted}`], { cwd: ROOT, encoding: "utf8", windowsHide: true })
    : spawnSync("/bin/sh", ["-c", quoted], { cwd: ROOT, encoding: "utf8", windowsHide: true });

  assert.equal(child.status, 0, `${child.stdout}\n${child.stderr}`);
  const events = await readTrace(staged.initial.trace_path);
  const claim = events.find((event) => event.type === "effect_claimed");
  assert.deepEqual(claim.data, { ...expected, index: 0, verb: "RUN" });
  assert.equal(alignDecision(staged.initial.decision, events).aggregate, "unproven");
});
