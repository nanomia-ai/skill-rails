import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { coreCli, repositoryRoot, runNode, temporary } from "./helpers.mjs";

const source = "domains/natural-language-pilot/skill-package.json";
const passAnswer = {
  schemaVersion: 1,
  cardId: "bookmark-storage",
  verdict: "pass",
  summary: "The targeted acceptance test passed.",
  checks: [{ name: "targeted-tests", outcome: "pass", evidence: [{ authority: "ai-reported", reference: "npm test -- bookmark-storage exited 0" }] }],
  unknowns: [],
};

async function setup(t, name, fixture = "project", sourcePath = source) {
  const root = await temporary(t, name);
  const built = coreCli("build", "--source", sourcePath, "--out-root", join(root, "dist"));
  assert.equal(built.status, 0, built.stdout);
  const target = join(root, "installed", "natural-language-pilot-verify-next");
  await cp(join(root, "dist", "skills", "natural-language-pilot-verify-next"), target, { recursive: true });
  const project = join(root, "project");
  await cp(resolve(repositoryRoot, "fixtures/verify-v1", fixture), project, { recursive: true });
  return { root, target, project };
}

async function setupWithRenderer(t, name, rendererSource) {
  const root = await temporary(t, name);
  const sourceRoot = join(root, "source");
  await cp(resolve(repositoryRoot, "domains", "natural-language-pilot"), sourceRoot, { recursive: true });
  await writeFile(join(sourceRoot, "targets", "verify", "renderer.mjs"), rendererSource);
  const built = coreCli("build", "--source", join(sourceRoot, "skill-package.json"), "--out-root", join(root, "dist"));
  assert.equal(built.status, 0, built.stdout);
  const target = join(root, "installed", "natural-language-pilot-verify-next");
  await cp(join(root, "dist", "skills", "natural-language-pilot-verify-next"), target, { recursive: true });
  const project = join(root, "project");
  await cp(resolve(repositoryRoot, "fixtures", "verify-v1", "project"), project, { recursive: true });
  return { target, project };
}

function initialize(target, project) {
  const result = runNode([join(target, "scripts", "run.mjs"), "initialize", "--project", project], { cwd: project });
  assert.equal(result.status, 0, result.stdout);
  return result.json;
}

async function answer(envelope, value = passAnswer) {
  await writeFile(envelope.answer, `${JSON.stringify(value)}\n`);
}

function record(target, envelope) {
  return runNode([join(target, "scripts", "run.mjs"), "record", "--exchange", envelope.exchange]);
}

test("record preserves human bytes, applies one card, and retries idempotently", async (t) => {
  const { target, project } = await setup(t, "record");
  const before = await readFile(join(project, "pilot", "verification.md"));
  const envelope = initialize(target, project);
  await answer(envelope);
  const applied = record(target, envelope);
  assert.equal(applied.status, 0, applied.stdout);
  assert.equal(applied.json.status, "APPLIED");
  assert.equal(applied.json.effect.authority, "observed");
  const after = await readFile(join(project, "pilot", "verification.md"));
  assert.deepEqual(after.subarray(0, before.length), before);
  assert.match(after.toString("utf8"), /skill-rails-next:verify-records:start/u);
  assert.match(after.toString("utf8"), /bookmark-storage — pass/u);
  const retried = record(target, envelope);
  assert.equal(retried.status, 0, retried.stdout);
  assert.equal(retried.json.status, "APPLIED_ALREADY");
  assert.equal(retried.json.effect, "none");
  assert.deepEqual(await readFile(join(project, "pilot", "verification.md")), after);
});

test("input stale and output conflict are distinct no-write results", async (t) => {
  const first = await setup(t, "input-stale");
  const firstEnvelope = initialize(first.target, first.project);
  await answer(firstEnvelope);
  await writeFile(join(first.project, "pilot", "plan.md"), "changed plan\n");
  const beforeInputRecord = await readFile(join(first.project, "pilot", "verification.md"));
  const stale = record(first.target, firstEnvelope);
  assert.equal(stale.json.code, "INPUT_STALE");
  assert.deepEqual(await readFile(join(first.project, "pilot", "verification.md")), beforeInputRecord);

  const second = await setup(t, "output-conflict");
  const secondEnvelope = initialize(second.target, second.project);
  await answer(secondEnvelope);
  const changed = Buffer.from("# changed by another session\n");
  await writeFile(join(second.project, "pilot", "verification.md"), changed);
  const conflict = record(second.target, secondEnvelope);
  assert.equal(conflict.json.code, "OUTPUT_CONFLICT");
  assert.deepEqual(await readFile(join(second.project, "pilot", "verification.md")), changed);
});

test("answer unknown fields and pass without evidence fail before output write", async (t) => {
  const { target, project } = await setup(t, "answer-invalid");
  const original = await readFile(join(project, "pilot", "verification.md"));
  const unknownField = initialize(target, project);
  await answer(unknownField, { ...passAnswer, outputPath: "elsewhere.md" });
  assert.equal(record(target, unknownField).json.code, "ANSWER_INVALID");
  const emptyEvidence = initialize(target, project);
  await answer(emptyEvidence, { ...passAnswer, checks: [{ name: "targeted-tests", outcome: "pass", evidence: [] }] });
  assert.equal(record(target, emptyEvidence).json.code, "ANSWER_INVALID");
  assert.deepEqual(await readFile(join(project, "pilot", "verification.md")), original);
});

test("record-only initializer and exchange fail closed on non-UTF-8 and unknown state", async (t) => {
  const invalidInput = await setup(t, "input-non-utf8");
  await writeFile(join(invalidInput.project, "pilot", "plan.md"), Buffer.from([0xff]));
  const rejected = runNode([join(invalidInput.target, "scripts", "run.mjs"), "initialize", "--project", invalidInput.project], { cwd: invalidInput.project });
  assert.notEqual(rejected.status, 0);
  assert.equal(rejected.json.code, "INITIALIZE_FAILED");

  const { target, project } = await setup(t, "exchange-unknown");
  const original = await readFile(join(project, "pilot", "verification.md"));
  const envelope = initialize(target, project);
  await answer(envelope);
  const exchangePath = join(envelope.exchange, "exchange.json");
  const exchange = JSON.parse(await readFile(exchangePath, "utf8"));
  exchange.semanticDecision = "pass";
  await writeFile(exchangePath, JSON.stringify(exchange));
  const result = record(target, envelope);
  assert.notEqual(result.status, 0);
  assert.equal(result.json.code, "ANSWER_INVALID");
  assert.deepEqual(await readFile(join(project, "pilot", "verification.md")), original);
});

test("managed-region bootstrap follows absent, empty, LF, and non-LF byte rules", async (t) => {
  for (const [name, initial, expectedPrefix] of [
    ["absent", null, "<!-- skill-rails-next:verify-records:start -->"],
    ["empty", Buffer.alloc(0), "<!-- skill-rails-next:verify-records:start -->"],
    ["lf", Buffer.from("human\n"), "human\n\n<!-- skill-rails-next:verify-records:start -->"],
    ["non-lf", Buffer.from("human"), "human\n\n<!-- skill-rails-next:verify-records:start -->"],
  ]) {
    const { target, project } = await setup(t, `bootstrap-${name}`);
    const output = join(project, "pilot", "verification.md");
    if (initial === null) await rm(output);
    else await writeFile(output, initial);
    const envelope = initialize(target, project);
    await answer(envelope);
    assert.equal(record(target, envelope).json.status, "APPLIED");
    const bytes = await readFile(output, "utf8");
    assert.ok(bytes.startsWith(expectedPrefix), name);
    assert.ok(bytes.endsWith("<!-- skill-rails-next:verify-records:end -->\n"), name);
  }
});

function invokeRenderer(target, current, value) {
  const input = JSON.stringify({ schemaVersion: 1, currentOutputBase64: Buffer.from(current).toString("base64"), validatedAnswer: value, domainConfig: { schemaVersion: 1, cardId: "bookmark-storage", verificationCommand: { program: "npm", args: ["test", "--", "bookmark-storage"], cwd: "." } } });
  const result = spawnSync(process.execPath, [join(target, "scripts", "domain", "renderer.mjs")], { input, encoding: null });
  assert.equal(result.status, 0, result.stderr.toString("utf8"));
  return result.stdout;
}

test("renderer preserves another card and updates only the selected card", async (t) => {
  const { target, project } = await setup(t, "other-card");
  const other = { ...passAnswer, cardId: "another-card", verdict: "unproven", summary: "Other evidence is incomplete.", checks: [{ name: "other-check", outcome: "unproven", evidence: [] }], unknowns: ["not observed"] };
  const prefix = Buffer.from("human prefix without LF");
  const withOther = invokeRenderer(target, prefix, other);
  await writeFile(join(project, "pilot", "verification.md"), withOther);
  const envelope = initialize(target, project);
  await answer(envelope);
  assert.equal(record(target, envelope).json.status, "APPLIED");
  const output = await readFile(join(project, "pilot", "verification.md"), "utf8");
  assert.ok(output.startsWith("human prefix without LF\n\n"));
  assert.match(output, /another-card — unproven/u);
  assert.match(output, /bookmark-storage — pass/u);
  assert.ok(output.indexOf("another-card") < output.indexOf("bookmark-storage"));
});

test("malformed and duplicate markers are no-write", async (t) => {
  for (const [name, content] of [
    ["missing-end", "human\n<!-- skill-rails-next:verify-records:start -->\n"],
    ["duplicate", "<!-- skill-rails-next:verify-records:start -->\n<!-- skill-rails-next:verify-records:end -->\n<!-- skill-rails-next:verify-records:start -->\n<!-- skill-rails-next:verify-records:end -->\n"],
  ]) {
    const { target, project } = await setup(t, `marker-${name}`);
    const output = join(project, "pilot", "verification.md");
    await writeFile(output, content);
    const envelope = initialize(target, project);
    await answer(envelope);
    const result = record(target, envelope);
    assert.equal(result.json.code, "MANAGED_REGION_INVALID", result.stdout);
    assert.equal(await readFile(output, "utf8"), content);
  }
});

test("duplicate card records are rejected without changing output", async (t) => {
  const { target, project } = await setup(t, "duplicate-card");
  const outputPath = join(project, "pilot", "verification.md");
  const valid = invokeRenderer(target, Buffer.from("human\n"), passAnswer).toString("utf8");
  const hiddenRecord = valid.match(/^<!-- skill-rails-next:verify-record:[A-Za-z0-9_-]+ -->$/mu)?.[0];
  assert.ok(hiddenRecord);
  const duplicate = valid.replace("<!-- skill-rails-next:verify-records:end -->", `${hiddenRecord}\n<!-- skill-rails-next:verify-records:end -->`);
  await writeFile(outputPath, duplicate);
  const envelope = initialize(target, project);
  await answer(envelope);
  const result = record(target, envelope);
  assert.equal(result.json.code, "MANAGED_REGION_INVALID", result.stdout);
  assert.equal(await readFile(outputPath, "utf8"), duplicate);
});

test("renderer failure and non-UTF-8 output are no-write failures", async (t) => {
  for (const [name, rendererSource] of [
    ["exit", 'process.stderr.write("synthetic renderer failure\\n"); process.exitCode = 1;\n'],
    ["non-utf8", "process.stdout.write(Buffer.from([0xff]));\n"],
  ]) {
    const { target, project } = await setupWithRenderer(t, `renderer-${name}`, rendererSource);
    const outputPath = join(project, "pilot", "verification.md");
    const before = await readFile(outputPath);
    const envelope = initialize(target, project);
    await answer(envelope);
    const result = record(target, envelope);
    assert.equal(result.json.code, "RENDER_FAILED", result.stdout);
    assert.deepEqual(await readFile(outputPath), before);
  }
});

test("output lock rejects a second record without silent loss", async (t) => {
  const { target, project } = await setup(t, "lock");
  const firstEnvelope = initialize(target, project);
  const secondEnvelope = initialize(target, project);
  await answer(firstEnvelope);
  await answer(secondEnvelope);
  const receipt = JSON.parse(await readFile(join(target, ".skill-rails-build.json"), "utf8"));
  const { record: directRecord } = await import(`${pathToFileURL(join(target, "scripts", "runtime", "record.mjs")).href}?one`);
  let release;
  let locked;
  const lockedPromise = new Promise((resolveLocked) => { locked = resolveLocked; });
  const releasePromise = new Promise((resolveRelease) => { release = resolveRelease; });
  const first = directRecord(target, receipt, firstEnvelope.exchange, { afterLock: async () => { locked(); await releasePromise; } });
  await lockedPromise;
  await assert.rejects(() => directRecord(target, receipt, secondEnvelope.exchange), (error) => error.code === "OUTPUT_BUSY");
  release();
  assert.equal((await first).status, "APPLIED");
  assert.match(await readFile(join(project, "pilot", "verification.md"), "utf8"), /bookmark-storage — pass/u);
});

test("exchange transplant and cross-basis reuse fail closed", async (t) => {
  const { root, target, project } = await setup(t, "transplant");
  const oldEnvelope = initialize(target, project);
  await answer(oldEnvelope);
  await writeFile(join(project, "pilot", "plan.md"), "# changed\n");
  const newEnvelope = initialize(target, project);
  await answer(newEnvelope, { ...passAnswer, verdict: "unproven", summary: "Current plan format is unknown.", checks: [{ name: "targeted-tests", outcome: "unproven", evidence: [] }], unknowns: ["plan format"] });
  assert.equal(record(target, oldEnvelope).json.code, "INPUT_STALE");
  const otherProject = join(root, "other-project");
  await cp(project, otherProject, { recursive: true });
  const transplanted = join(otherProject, ".skill-rails-next", "exchanges", "transplanted");
  await mkdir(dirname(transplanted), { recursive: true });
  await cp(newEnvelope.exchange, transplanted, { recursive: true });
  const result = runNode([join(target, "scripts", "run.mjs"), "record", "--exchange", transplanted]);
  assert.equal(result.json.code, "PATH_OUTSIDE_ROOT");
});

test("post-write reread mismatch never claims observed effect", async (t) => {
  const { target, project } = await setup(t, "reread");
  const envelope = initialize(target, project);
  await answer(envelope);
  const receipt = JSON.parse(await readFile(join(target, ".skill-rails-build.json"), "utf8"));
  const { record: directRecord } = await import(`${pathToFileURL(join(target, "scripts", "runtime", "record.mjs")).href}?fault`);
  await assert.rejects(
    () => directRecord(target, receipt, envelope.exchange, { afterReplace: ({ output }) => writeFile(output, "fault-injected\n") }),
    (error) => error.code === "APPLY_NOT_OBSERVED" && error.details.authority === "attempted",
  );
  assert.equal(await readFile(join(project, "pilot", "verification.md"), "utf8"), "fault-injected\n");
});

test("CRLF-converted managed frame is updated without creating a second region", async (t) => {
  const { target, project } = await setup(t, "crlf");
  const first = initialize(target, project);
  await answer(first);
  assert.equal(record(target, first).json.status, "APPLIED");
  const outputPath = join(project, "pilot", "verification.md");
  const converted = (await readFile(outputPath, "utf8")).replace(/\n/g, "\r\n");
  await writeFile(outputPath, converted);
  const second = initialize(target, project);
  await answer(second, { ...passAnswer, summary: "The targeted acceptance test passed again." });
  const secondResult = record(target, second);
  assert.equal(secondResult.json.status, "APPLIED", JSON.stringify(secondResult.json));
  const output = await readFile(outputPath, "utf8");
  assert.equal((output.match(/skill-rails-next:verify-records:start/g) ?? []).length, 1);
  assert.ok(output.startsWith("# Human verification notes\r\n"));
});
