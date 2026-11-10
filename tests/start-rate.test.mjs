import test from "node:test";
import assert from "node:assert/strict";
import { realpathSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { installedCopies } from "../src/core/start-rate.mjs";
import { coreCli, temporary } from "./helpers.mjs";

// A stand-in host: it reads the probe when the request asks for it, as a host that starts the skill would.
const fakeHost = `
import { existsSync, readFileSync } from "node:fs";
let request = "";
process.stdin.on("data", (chunk) => { request += chunk; });
process.stdin.on("end", () => {
  if (process.argv[2] !== 'say "hi & echo INJECTED" 100% %OS% done') { process.stderr.write("argument changed: " + process.argv[2]); process.exit(3); }
  const skill = ".fake/skills/demo";
  if (request.includes("broken")) { process.stderr.write("not logged in"); process.exit(2); }
  if (request.includes("hang")) { setInterval(() => {}, 1000); return; }
  if (request.includes("open it") && existsSync(skill + "/agents/openai.yaml")) process.stdout.write(readFileSync(skill + "/SKILL.md", "utf8"));
  process.stdout.write("done");
});
`;

async function startPackage(t, tasks) {
  const root = await temporary(t, "start-rate");
  await mkdir(join(root, "targets", "demo", "tests"), { recursive: true });
  await mkdir(join(root, "targets", "demo", "host-files"), { recursive: true });
  await writeFile(join(root, "skill-package.json"), JSON.stringify({ schemaVersion: 2, packageId: "p", packageVersion: "1", modules: {}, targets: { demo: "targets/demo/target.json" } }));
  await writeFile(join(root, "targets", "demo", "target.json"), JSON.stringify({ schemaVersion: 2, targetId: "demo", entry: "entry.md", imports: [], files: { "agents/openai.yaml": "host-files/openai.yaml" } }));
  await writeFile(join(root, "targets", "demo", "host-files", "openai.yaml"), "policy:\n  allow_implicit_invocation: true\n");
  await writeFile(join(root, "targets", "demo", "entry.md"), "---\nname: demo\ndescription: >\n  Total receipts by category\n  for expense reports.\n---\n# Demo\nThe body never reaches the probe.\n");
  await writeFile(join(root, "targets", "demo", "tests", "tasks.md"), tasks);
  await writeFile(join(root, "fake-host.mjs"), fakeHost);
  await writeFile(join(root, "host.json"), JSON.stringify({ id: "fake", skillsDir: ".fake/skills", command: [process.execPath, join(root, "fake-host.mjs"), 'say "hi & echo INJECTED" 100% %OS% done'] }));
  // A host started through a batch file, as npm and Volta install command-line tools on Windows.
  await writeFile(join(root, "fake host.cmd"), `@echo off\r\n"${process.execPath}" "${join(root, "fake-host.mjs")}" %*\r\n`);
  await writeFile(join(root, "batch-host.json"), JSON.stringify({ id: "batch", skillsDir: ".fake/skills", command: [join(root, "fake host.cmd"), 'say "hi & echo INJECTED" 100% %OS% done'] }));
  return root;
}

const task = (name, start, request) => `## ${name}\nRequest: ${request}\nStart: ${start}\n\n`;

test("start-rate counts starts per task from fresh runs and holds two in five of each kind out", async (t) => {
  const tasks = "# Demo tasks\n\n```markdown\n## not a task\nStart: nonsense\n```\n\n"
    + task("named one", "named", "use demo")
    + ["a", "b", "c", "d", "e"].map((id) => task(`should ${id}`, "unnamed, should start", id === "e" ? "total these, hang on" : `total these and open it ${id}`)).join("")
    + ["f", "g", "h"].map((id) => task(`near ${id}`, "unnamed, must not start", id === "h" ? "translate and open it" : `translate ${id}`)).join("");
  const root = await startPackage(t, tasks);
  const result = coreCli("start-rate", "--source", join(root, "skill-package.json"), "--target", "demo", "--host", join(root, "host.json"), "--runs", "2", "--timeout", "10");
  assert.equal(result.status, 0, result.stdout);
  assert.equal(result.json.status, "MEASURED");
  assert.equal(result.json.description, "Total receipts by category for expense reports.");
  assert.equal(result.json.heldOutTasks, 3);
  const fake = result.json.scores.fake;
  assert.equal(fake.tuning.total + fake.heldOut.total, 8);
  assert.equal(fake.heldOut.total, 3);
  for (const row of result.json.tuning) {
    const counts = row.byHost.fake;
    const name = row.task;
    if (name === "should e") assert.deepEqual(counts, { started: 0, runs: 2, timedOut: 2, errors: 0, pass: null });
    else if (name === "near h") assert.deepEqual(counts, { started: 2, runs: 2, timedOut: 0, errors: 0, pass: false });
    else if (name.startsWith("should")) assert.deepEqual(counts, { started: 2, runs: 2, timedOut: 0, errors: 0, pass: true });
    else assert.deepEqual(counts, { started: 0, runs: 2, timedOut: 0, errors: 0, pass: true });
  }
  assert.equal(result.json.tuning.some((row) => row.task === "named one"), false);
  assert.equal("request" in result.json.tuning[0], false);
});

test("start-rate reports runs that did not run and refuses tasks it cannot read", async (t) => {
  const root = await startPackage(t, task("broken one", "unnamed, should start", "broken"));
  const result = coreCli("start-rate", "--source", join(root, "skill-package.json"), "--target", "demo", "--host", join(root, "host.json"), "--runs", "1");
  assert.equal(result.status, 0, result.stdout);
  assert.deepEqual(result.json.tuning[0].byHost.fake, { started: 0, runs: 1, timedOut: 0, errors: 1, pass: null });
  assert.match(result.json.errors.fake, /not logged in/u);
  assert.match(result.json.nextAction, /measure again/u);

  await writeFile(join(root, "targets", "demo", "tests", "tasks.md"), "## vague\nRequest: something\nStart: maybe\n");
  const invalid = coreCli("start-rate", "--source", join(root, "skill-package.json"), "--target", "demo", "--host", join(root, "host.json"));
  assert.equal(invalid.json.code, "TASKS_INVALID");
  const noHost = coreCli("start-rate", "--source", join(root, "skill-package.json"), "--target", "demo", "--host", "nowhere");
  assert.equal(noHost.json.code, "ARGUMENT_INVALID");
  await writeFile(join(root, "escape.json"), JSON.stringify({ id: "x", skillsDir: "../outside", command: ["x"] }));
  assert.equal(coreCli("start-rate", "--source", join(root, "skill-package.json"), "--target", "demo", "--host", join(root, "escape.json")).json.code, "ARGUMENT_INVALID");
  assert.equal(coreCli("start-rate", "--source", join(root, "skill-package.json"), "--target", "demo", "--host", ",").json.code, "ARGUMENT_INVALID");
  await writeFile(join(root, "same-id.json"), JSON.stringify({ id: "fake", skillsDir: ".other", command: ["x"] }));
  assert.equal(coreCli("start-rate", "--source", join(root, "skill-package.json"), "--target", "demo", "--host", `${join(root, "host.json")},${join(root, "same-id.json")}`).json.code, "ARGUMENT_INVALID");
  const badRuns = coreCli("start-rate", "--source", join(root, "skill-package.json"), "--target", "demo", "--host", "claude", "--runs", "0");
  assert.equal(badRuns.json.code, "ARGUMENT_INVALID");
});

test("installed copies of the skill are found where hosts keep user, synced, and plugin skills", async (t) => {
  const root = await temporary(t, "copies");
  for (const path of ["skills/demo", "skills/synced/abc/demo", "cache/market/plugin/1.0.0/skills/demo", "skills/other"]) {
    await mkdir(join(root, path), { recursive: true });
    await writeFile(join(root, path, "SKILL.md"), "---\nname: demo\n---\n");
  }
  await mkdir(join(root, "skills", "notes", "demo"), { recursive: true });
  const base = realpathSync(root).replaceAll("\\", "/");
  const found = installedCopies([join(root, "skills"), join(root, "cache")], "demo").map((path) => path.slice(base.length + 1)).sort();
  assert.deepEqual(found, ["cache/market/plugin/1.0.0/skills/demo/SKILL.md", "skills/demo/SKILL.md", "skills/synced/abc/demo/SKILL.md"]);
});

test("on Windows a host started through a batch file gets its arguments intact", { skip: process.platform !== "win32" && "batch files run only on Windows" }, async (t) => {
  const root = await startPackage(t, task("should a", "unnamed, should start", "total these and open it"));
  const result = coreCli("start-rate", "--source", join(root, "skill-package.json"), "--target", "demo", "--host", join(root, "batch-host.json"), "--runs", "1");
  assert.equal(result.status, 0, result.stdout);
  assert.deepEqual(result.json.tuning[0].byHost.batch, { started: 1, runs: 1, timedOut: 0, errors: 0, pass: true }, JSON.stringify(result.json.errors));
});
