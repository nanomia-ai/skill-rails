import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, extname, isAbsolute, join, resolve } from "node:path";
import { compareCodePoint, sha256 } from "./canonicalize.mjs";
import { fail } from "./errors.mjs";
import { fileArtifactPath } from "./build.mjs";
import { readSkillFrontmatter } from "./frontmatter.mjs";

// Each known host run headless in a folder, with the request on standard input; a host file gives the same for any other.
const PRESETS = {
  claude: {
    skillsDir: ".claude/skills",
    command: ["claude", "-p", "--output-format", "stream-json", "--verbose"],
    userSkillDirs: () => {
      const home = process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude");
      return [join(home, "skills"), join(home, "plugins", "cache"), join(home, "plugins", "synced")];
    },
  },
  codex: {
    skillsDir: ".agents/skills",
    command: ["codex", "exec", "--sandbox", "read-only", "--skip-git-repo-check", "--ephemeral", "--json", "-"],
    userSkillDirs: () => {
      const home = process.env.CODEX_HOME ?? join(homedir(), ".codex");
      return [join(homedir(), ".agents", "skills"), join(home, "skills"), join(home, "plugins", "cache")];
    },
  },
};
const START_KINDS = new Map([["unnamed, should start", "start"], ["unnamed, must not start", "no start"]]);

export function readStartTasks(text, logicalPath) {
  const tasks = [];
  let current = null;
  let field = null;
  let fenced = false;
  for (const line of text.split(/\r?\n/u)) {
    if (/^(```|~~~)/u.test(line)) { fenced = !fenced; continue; }
    if (fenced) continue;
    const heading = /^## (.+)$/u.exec(line);
    if (heading) { current = { name: heading[1].trim(), fields: {} }; tasks.push(current); field = null; continue; }
    if (!current) continue;
    const label = /^(Request|Start|Inputs|Must hold):[ \t]*(.*)$/u.exec(line);
    if (label) { field = label[1]; current.fields[field] = label[2]; continue; }
    if (field) current.fields[field] += `\n${line}`;
  }
  const names = new Set();
  const starts = [];
  for (const task of tasks) {
    if (names.has(task.name)) fail("TASKS_INVALID", `${logicalPath} repeats the task name ${task.name}.`, "Give every task its own name.");
    names.add(task.name);
    const start = task.fields.Start?.trim().toLowerCase();
    if (start === undefined) fail("TASKS_INVALID", `${logicalPath} task ${task.name} has no Start line.`, "Add Start: named, unnamed, should start, or unnamed, must not start.");
    if (start === "named") continue;
    if (!START_KINDS.has(start)) fail("TASKS_INVALID", `${logicalPath} task ${task.name} has Start: ${start}.`, "Use Start: named, unnamed, should start, or unnamed, must not start.");
    const request = task.fields.Request?.trim();
    if (!request) fail("TASKS_INVALID", `${logicalPath} task ${task.name} has no Request.`, "Write the request a user would type after Request:.");
    starts.push({ name: task.name, expect: START_KINDS.get(start), request });
  }
  return starts;
}

// The same tasks are held out every time: two in five of each kind, by the hash of their names.
function holdOut(tasks) {
  const held = new Set();
  for (const kind of START_KINDS.values()) {
    const ofKind = tasks.filter((task) => task.expect === kind).sort((a, b) => compareCodePoint(sha256(a.name), sha256(b.name)));
    for (const task of ofKind.slice(0, Math.floor(ofKind.length * 0.4))) held.add(task.name);
  }
  return held;
}

async function loadHost(spec) {
  if (Object.hasOwn(PRESETS, spec)) return { id: spec, ...PRESETS[spec] };
  let value;
  try { value = JSON.parse(await readFile(resolve(spec), "utf8")); }
  catch { fail("ARGUMENT_INVALID", `--host ${spec} is neither ${Object.keys(PRESETS).join(" nor ")} nor a readable JSON host file.`, "Name a known host, or give a host file {\"id\", \"skillsDir\", \"command\"} whose command reads the request on standard input."); }
  if (typeof value?.id !== "string" || typeof value.skillsDir !== "string" || !Array.isArray(value.command) || !value.command.length || !value.command.every((part) => typeof part === "string")) fail("ARGUMENT_INVALID", `Host file ${spec} needs id, skillsDir, and a non-empty command array of strings.`, "Correct the host file.");
  if (isAbsolute(value.skillsDir) || value.skillsDir.includes("\\") || value.skillsDir.split("/").some((part) => !part || part === "." || part === "..")) fail("ARGUMENT_INVALID", `Host file ${spec} skillsDir must be a relative path inside the run's folder: ${value.skillsDir}`, "Give the folder, relative to a project, where that host finds project skills, using forward slashes.");
  return { id: value.id, skillsDir: value.skillsDir, command: value.command, userSkillDirs: null };
}

// Same-name copies under a host's user folders, its synced and plugin skills included, a few levels deep.
export function installedCopies(roots, name) {
  const found = new Set();
  const walk = (dir, depth) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if ((!entry.isDirectory() && !entry.isSymbolicLink()) || entry.name === "node_modules" || entry.name === ".git") continue;
      const path = join(dir, entry.name);
      if (entry.name === name && existsSync(join(path, "SKILL.md"))) found.add(realpathSync(join(path, "SKILL.md")).replaceAll("\\", "/"));
      else if (depth > 0) walk(path, depth - 1);
    }
  };
  for (const root of roots) walk(root, 5);
  return [...found];
}

// A copy of this skill installed for the user would be the one the host shows, so the probe must be the only one it sees.
function isolate(host, name) {
  if (!host.userSkillDirs) return { ...host, isolation: `not known for this host: a copy of ${name} it loads from elsewhere may be the one it shows, so remove it from the host for the measurement` };
  const copies = installedCopies(host.userSkillDirs(), name);
  if (!copies.length) return { ...host, isolation: null };
  if (host.id === "codex") {
    const config = `skills.config=[${copies.map((path) => `{path='${path}',enabled=false}`).join(",")}]`;
    return { ...host, command: [host.command[0], host.command[1], "-c", config, ...host.command.slice(2)], isolation: `disabled the installed copy at ${copies.join(", ")} for each run` };
  }
  // Hiding the user's settings would also drop the model they chose, so it is passed on explicitly.
  let model = null;
  try { model = JSON.parse(readFileSync(join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude"), "settings.json"), "utf8")).model ?? null; } catch { /* no user model */ }
  const keep = typeof model === "string" && !host.command.includes("--model") ? ["--model", model] : [];
  return { ...host, command: [host.command[0], host.command[1], "--setting-sources", "project", ...keep, ...host.command.slice(2)], isolation: `hid user-level skills, plugins, and settings${keep.length ? ` except the model ${model}` : ""}, since a copy is installed at ${copies.join(", ")}; skills that compete from there are not measured` };
}

// Windows starts a .cmd or .bat only through its shell; anything else runs directly, so its arguments arrive intact.
function windowsProgram(file) {
  const extensions = (process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean).map((ext) => ext.toLowerCase());
  const names = extensions.includes(extname(file).toLowerCase()) ? [file] : extensions.map((ext) => file + ext);
  const dirs = /[\\/]/u.test(file) ? [""] : (process.env.PATH ?? "").split(";").filter(Boolean);
  for (const dir of dirs) for (const candidate of names) {
    const path = dir ? join(dir, candidate) : candidate;
    try { if (statSync(path).isFile()) return path; } catch { /* next candidate */ }
  }
  return null;
}

// cmd.exe reads its line, and a batch file's %* reads the arguments again, so each argument is quoted for the program
// and its shell characters escaped once per reading (the cross-spawn rules).
const CMD_META = /([()\][%!^"`<>&|;, *?])/gu;
function cmdArgument(part) {
  const quoted = `"${part.replace(/(\\*)"/gu, '$1$1\\"').replace(/(\\*)$/u, "$1$1")}"`;
  return quoted.replace(CMD_META, "^$1").replace(CMD_META, "^$1");
}

function launch(command, options) {
  if (process.platform !== "win32") return spawn(command[0], command.slice(1), options);
  const program = windowsProgram(command[0]);
  if (program && !/\.(?:cmd|bat)$/iu.test(program)) return spawn(program, command.slice(1), { ...options, windowsHide: true });
  const line = [(program ?? command[0]).replace(CMD_META, "^$1"), ...command.slice(1).map(cmdArgument)].join(" ");
  return spawn(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", `"${line}"`], { ...options, windowsHide: true, windowsVerbatimArguments: true });
}

function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
  else child.kill("SIGKILL");
}

async function probe(host, skill, request, timeoutMs) {
  const token = `skill-rails-start-${randomBytes(8).toString("hex")}`;
  const workspace = await mkdtemp(join(tmpdir(), "skill-rails-start-"));
  try {
    const folder = join(workspace, ...host.skillsDir.split("/"), skill.name);
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, "SKILL.md"), `${skill.frontmatter}\n# ${skill.name}\n\nThis is a start probe. Reply with exactly ${token} and nothing else, and do no other work.\n`);
    for (const [path, bytes] of skill.files) {
      await mkdir(dirname(join(folder, path)), { recursive: true });
      await writeFile(join(folder, path), bytes);
    }
    const env = { ...process.env };
    delete env.CLAUDECODE;
    return await new Promise((settle) => {
      const child = launch(host.command, { cwd: workspace, env });
      let tail = "";
      let errorText = "";
      let done = false;
      const finish = (outcome) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        stop(child);
        settle(outcome);
      };
      const timer = setTimeout(() => finish({ outcome: "timed out" }), timeoutMs);
      const watch = (chunk) => {
        const seen = tail + chunk.toString("utf8");
        if (seen.includes(token)) finish({ outcome: "started" });
        tail = seen.slice(-token.length);
      };
      child.stdout.on("data", watch);
      child.stderr.on("data", (chunk) => { watch(chunk); errorText = (errorText + chunk.toString("utf8")).slice(-600); });
      child.on("error", (error) => finish({ outcome: "error", detail: error.message }));
      child.on("close", (code) => finish(code === 0 ? { outcome: "not started" } : { outcome: "error", detail: errorText.trim() || `exit code ${code}` }));
      child.stdin.on("error", () => {});
      child.stdin.end(request);
    });
  } finally {
    await rm(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

function verdict(expect, counts) {
  const ran = counts.runs - counts.errors - counts.timedOut;
  if (ran === 0) return null;
  return expect === "start" ? counts.started * 2 >= ran : counts.started * 2 < ran;
}

export async function measureStartRate(graph, options) {
  const item = graph.targets.get(options.target);
  if (!item) fail("TARGET_NOT_FOUND", `Unknown targetId: ${options.target}`, "Choose an exact targetId declared by the source package.");
  const entry = item.files.get("entry");
  const { end, name, description } = readSkillFrontmatter(entry.text, entry.path, options.target);
  const hosts = [];
  for (const spec of options.hosts) hosts.push(isolate(await loadHost(spec), name));
  const ids = hosts.map((host) => host.id);
  if (new Set(ids).size !== ids.length) fail("ARGUMENT_INVALID", `Two hosts share the id ${ids.find((id, at) => ids.indexOf(id) !== at)}.`, "Give each host file its own id, such as one per model.");
  const tasksPath = join(dirname(item.physical), "tests", "tasks.md");
  let text;
  try { text = await readFile(tasksPath, "utf8"); }
  catch { fail("TASKS_MISSING", `No tests/tasks.md beside the descriptor of ${options.target}.`, "Save the target's start tasks in tests/tasks.md beside its descriptor first."); }
  const tasks = readStartTasks(text, `tests/tasks.md of ${options.target}`);
  if (!tasks.length) fail("TASKS_MISSING", `tests/tasks.md of ${options.target} has no unnamed task.`, "Save start tasks with Start: unnamed, should start or unnamed, must not start.");
  const skill = {
    name,
    frontmatter: entry.text.slice(0, end + 5),
    files: item.delivered.flatMap((delivered) => delivered.files.map((file) => [fileArtifactPath(delivered, file), file.bytes])),
  };

  const counts = new Map();
  const jobs = [];
  for (const task of tasks) for (const host of hosts) {
    const tally = { started: 0, runs: options.runs, timedOut: 0, errors: 0 };
    counts.set(`${task.name}\u0000${host.id}`, tally);
    for (let run = 0; run < options.runs; run += 1) jobs.push({ task, host, tally });
  }
  const errors = new Map();
  let timedOut = 0;
  const worker = async () => {
    for (let job = jobs.shift(); job; job = jobs.shift()) {
      const result = await probe(job.host, skill, job.task.request, options.timeoutSeconds * 1000);
      if (result.outcome === "started") job.tally.started += 1;
      if (result.outcome === "timed out") { job.tally.timedOut += 1; timedOut += 1; }
      if (result.outcome === "error") { job.tally.errors += 1; if (!errors.has(job.host.id)) errors.set(job.host.id, result.detail); }
    }
  };
  await Promise.all(Array.from({ length: options.workers }, worker));

  const held = holdOut(tasks);
  const tuning = [];
  const scores = Object.fromEntries(hosts.map((host) => [host.id, { tuning: { passed: 0, total: 0 }, heldOut: { passed: 0, total: 0 } }]));
  for (const task of tasks) {
    const byHost = {};
    for (const host of hosts) {
      const tally = counts.get(`${task.name}\u0000${host.id}`);
      const pass = verdict(task.expect, tally);
      const score = scores[host.id][held.has(task.name) ? "heldOut" : "tuning"];
      score.total += 1;
      if (pass) score.passed += 1;
      byHost[host.id] = { ...tally, pass };
    }
    if (!held.has(task.name)) tuning.push({ task: task.name, expect: task.expect, byHost });
  }
  return {
    schemaVersion: 1,
    status: "MEASURED",
    targetId: options.target,
    description,
    descriptionCharacters: [...description].length,
    runsPerTask: options.runs,
    hosts: hosts.map(({ id, command, isolation }) => ({ id, command, ...(isolation ? { isolation } : {}) })),
    tuning,
    heldOutTasks: held.size,
    scores,
    ...(errors.size ? { errors: Object.fromEntries(errors) } : {}),
    ...(errors.size || timedOut ? { nextAction: "Some runs failed or timed out and count for neither side; fix the host command or its login, or raise --timeout, then measure again before relying on these counts." } : {}),
  };
}
