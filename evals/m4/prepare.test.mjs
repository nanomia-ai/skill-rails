import test from "node:test";
import assert from "node:assert/strict";
import { cp, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { coreCli, repositoryRoot, runNode, temporary } from "../../tests/helpers.mjs";

const source = "domains/natural-language-pilot/skill-package.json";

async function setup(t, name) {
  const root = await temporary(t, name);
  const sourceRoot = join(root, "prepare-record-source");
  await cp(resolve(repositoryRoot, "domains", "natural-language-pilot"), sourceRoot, { recursive: true });
  await cp(resolve(repositoryRoot, "fixtures", "verify-v1", "prepare-record-target.json"), join(sourceRoot, "targets", "verify", "target.json"), { force: true });
  await cp(resolve(repositoryRoot, "fixtures", "verify-v1", "prepare-record-entry.md"), join(sourceRoot, "targets", "verify", "entry.md"), { force: true });
  const built = coreCli("build", "--source", join(sourceRoot, "skill-package.json"), "--out-root", join(root, "dist"));
  assert.equal(built.status, 0, built.stdout);
  const target = join(root, "installed", "natural-language-pilot-verify-next");
  await cp(join(root, "dist", "skills", "natural-language-pilot-verify-next"), target, { recursive: true });
  const project = join(root, "project");
  await cp(resolve(repositoryRoot, "fixtures/verify-v1/project"), project, { recursive: true });
  return { root, target, project };
}

function prepare(target, project) {
  return runNode([join(target, "scripts", "run.mjs"), "prepare", "--project", project], { cwd: project });
}

test("standalone prepare returns a locator and an eight-block bounded packet", async (t) => {
  const { target, project } = await setup(t, "prepare");
  const result = prepare(target, project);
  assert.equal(result.status, 0, result.stdout);
  assert.equal(result.json.status, "PREPARED");
  const packet = await readFile(result.json.packet, "utf8");
  assert.deepEqual([...packet.matchAll(/^## (.+)$/gm)].map((match) => match[1]), ["Purpose", "Observed", "Do now", "Judgment", "Read", "Return", "Done when", "Authority and recovery"]);
  assert.doesNotMatch(packet, /Verify control baseline/u);
  const answer = JSON.parse(await readFile(result.json.answer, "utf8"));
  assert.deepEqual(answer, { cardId: "bookmark-storage", checks: [], schemaVersion: 1, summary: null, unknowns: [], verdict: null });
  assert.match(result.json.recordCommand, / record --exchange /u);
});

test("semantic decision hash is deterministic while exchanges remain nonce-isolated", async (t) => {
  const { target, project } = await setup(t, "determinism");
  const first = prepare(target, project);
  const second = prepare(target, project);
  assert.equal(first.status, 0, first.stdout);
  assert.equal(second.status, 0, second.stdout);
  assert.equal(first.json.decisionSha256, second.json.decisionSha256);
  assert.notEqual(first.json.packet, second.json.packet);
  const firstDecision = JSON.parse(await readFile(join(first.json.packet, "..", "decision.json"), "utf8"));
  const secondDecision = JSON.parse(await readFile(join(second.json.packet, "..", "decision.json"), "utf8"));
  assert.deepEqual(firstDecision, secondDecision);
});

test("observer reports unfamiliar prose as unknown instead of inferring meaning", async (t) => {
  const { target, project } = await setup(t, "unknown");
  await writeFile(join(project, "pilot", "plan.md"), "# A free-form plan with no fixture marker\n");
  const result = prepare(target, project);
  assert.equal(result.status, 0, result.stdout);
  const decision = JSON.parse(await readFile(join(result.json.packet, "..", "decision.json"), "utf8"));
  assert.deepEqual(decision.observed.unknowns, [{ basisPaths: ["pilot/plan.md"], id: "card-id", reasonCode: "FIXTURE_PLAN_FORMAT_UNKNOWN" }]);
  assert.equal(decision.observed.facts.some((fact) => fact.id === "card-id"), false);
});

test("two project copies with identical bytes produce the same semantic hash", async (t) => {
  const { root, target, project } = await setup(t, "portable-hash");
  const other = join(root, "other-project");
  await cp(project, other, { recursive: true });
  const first = prepare(target, project);
  const second = prepare(target, other);
  assert.equal(first.status, 0, first.stdout);
  assert.equal(second.status, 0, second.stdout);
  assert.equal(first.json.decisionSha256, second.json.decisionSha256);
});

test("preserved prepare-record exchange remains record-compatible", async (t) => {
  const { target, project } = await setup(t, "prepare-record-compatible");
  const prepared = prepare(target, project);
  assert.equal(prepared.status, 0, prepared.stdout);
  await writeFile(prepared.json.answer, `${JSON.stringify({
    schemaVersion: 1,
    cardId: "bookmark-storage",
    verdict: "pass",
    summary: "The targeted acceptance test passed.",
    checks: [{ name: "targeted-tests", outcome: "pass", evidence: [{ authority: "ai-reported", reference: "npm test -- bookmark-storage exited 0" }] }],
    unknowns: [],
  })}\n`);
  const recorded = runNode([join(target, "scripts", "run.mjs"), "record", "--exchange", dirname(prepared.json.packet)], { cwd: project });
  assert.equal(recorded.status, 0, recorded.stdout);
  assert.equal(recorded.json.status, "APPLIED");
});

test("fixture verification command has fixed success and failure evidence", async () => {
  const run = (cwd) => import("node:child_process").then(({ spawnSync }) => process.platform === "win32"
    ? spawnSync("cmd.exe", ["/d", "/s", "/c", "npm test -- bookmark-storage"], { cwd, encoding: "utf8" })
    : spawnSync("npm", ["test", "--", "bookmark-storage"], { cwd, encoding: "utf8" }));
  const ok = await run(resolve(repositoryRoot, "fixtures/verify-v1/project"));
  assert.equal(ok.status, 0, ok.stderr || ok.stdout);
  assert.match(ok.stdout, /bookmark-storage/u);
  const failed = await run(resolve(repositoryRoot, "fixtures/verify-v1/failure-project"));
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /fixed fixture failure/u);
});
