import { hostname } from "node:os";
import { mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, relative, resolve, sep } from "node:path";
import { TextDecoder } from "node:util";
import { basisPublic, canonicalJson, ensureDirectory, ensureProject, fail, fileBasis, nonce, readJson, runChild, sha256, validate } from "./common.mjs";

const decoder = new TextDecoder("utf-8", { fatal: true });
const FRAME = /^<!-- skill-rails-next:([a-z0-9]+(?:-[a-z0-9]+)*):(start|end) -->\r?$/gm;

function sameBasis(left, right) {
  return left?.path === right?.path && left?.state === right?.state && left?.sha256 === right?.sha256;
}

function decode(bytes, code, message) {
  try { return decoder.decode(bytes); } catch { fail(code, message, "Inspect the renderer and retry without changing the answer semantics."); }
}

function locateFrame(text, existing) {
  const matches = [...text.matchAll(FRAME)];
  if (matches.length === 0) return null;
  const code = existing ? "MANAGED_REGION_INVALID" : "RENDER_FAILED";
  const nextAction = existing ? "Have a person decide how to repair the managed-region boundary." : "Correct the renderer without changing the answer semantics.";
  if (matches.length !== 2 || matches[0][2] !== "start" || matches[1][2] !== "end" || matches[0][1] !== matches[1][1] || matches[0].index >= matches[1].index) fail(code, "Managed-region frame is missing, duplicated, or malformed.", nextAction);
  return { id: matches[0][1], prefix: text.slice(0, matches[0].index), suffix: text.slice(matches[1].index + matches[1][0].length) };
}

function assertFramePreserved(currentBytes, desiredBytes) {
  const current = decode(currentBytes, "MANAGED_REGION_INVALID", "Current output is not valid UTF-8.");
  const desired = decode(desiredBytes, "RENDER_FAILED", "Renderer output is not valid UTF-8.");
  const before = locateFrame(current, true);
  const after = locateFrame(desired, false);
  if (!after) fail("RENDER_FAILED", "Renderer output contains no managed-region frame.", "Correct the renderer without changing the answer semantics.");
  if (before) {
    if (before.id !== after.id || Buffer.compare(Buffer.from(before.prefix), Buffer.from(after.prefix)) !== 0 || Buffer.compare(Buffer.from(before.suffix), Buffer.from(after.suffix)) !== 0) fail("RENDER_FAILED", "Renderer changed bytes outside its managed region.", "Correct the renderer and preserve the existing prefix and suffix exactly.");
    return;
  }
  const separator = current.length === 0 ? "" : current.endsWith("\n") ? "\n" : "\n\n";
  if (after.prefix !== `${current}${separator}` || after.suffix !== "\n") fail("RENDER_FAILED", "Renderer violated the managed-region bootstrap byte contract.", "Correct the renderer and preserve the existing bytes exactly.");
}

function assertBoundExchange(projectRoot, exchangeRoot) {
  const parent = resolve(projectRoot, ".skill-rails-next", "exchanges");
  const fromParent = relative(parent, exchangeRoot);
  if (!fromParent || fromParent === ".." || fromParent.startsWith(`..${sep}`) || fromParent.includes(sep) || fromParent.includes("/")) fail("PATH_OUTSIDE_ROOT", "Exchange is not in the bound project's exchange directory.", "Initialize or prepare again in the intended project.");
}

export async function record(targetRoot, receipt, exchangeArgument, hooks = {}) {
  const exchangeRoot = await realpath(resolve(exchangeArgument)).catch(() => fail("PATH_OUTSIDE_ROOT", "Exchange directory does not exist.", "Use the exact exchange returned by initialize or prepare."));
  const exchange = await readJson(resolve(exchangeRoot, "exchange.json"), "ANSWER_INVALID");
  const exchangeSchema = await readJson(resolve(targetRoot, "contracts", "record-exchange.schema.json"));
  const exchangeErrors = validate(exchange, exchangeSchema);
  if (exchangeErrors.length) fail("ANSWER_INVALID", "Exchange violates its closed contract.", "Initialize or prepare again; do not repair or transplant the exchange.", exchangeErrors);
  const projectRoot = await ensureProject(exchange.projectRoot);
  const currentTargetRoot = await realpath(targetRoot);
  if (await realpath(exchange.targetRoot).catch(() => null) !== currentTargetRoot || exchange.packageId !== receipt.packageId || exchange.packageVersion !== receipt.packageVersion || exchange.targetId !== receipt.targetId || exchange.receiptTreeSha256 !== receipt.treeSha256) fail("ARTIFACT_INTEGRITY_FAILED", "Exchange target identity differs from the installed target.", "Initialize or prepare again with this installed target.");
  assertBoundExchange(projectRoot, exchangeRoot);
  const target = await readJson(resolve(targetRoot, "config", "target.json"));
  if (target.mode !== exchange.mode || target.declaredOutput !== exchange.declaredOutput) fail("ARTIFACT_INTEGRITY_FAILED", "Exchange mode or output identity differs from the target.", "Initialize or prepare again with this installed target.");
  if (exchange.basis.output.path !== target.declaredOutput || exchange.basis.inputs.map((item) => item.path).join("\0") !== target.declaredInputs.join("\0")) fail("ANSWER_INVALID", "Exchange basis does not exactly match the target declarations.", "Initialize or prepare again; do not transplant basis rows.");
  if (exchange.mode === "prepare-record") {
    const decision = await readJson(resolve(exchangeRoot, "decision.json"), "ANSWER_INVALID");
    const { decisionSha256, ...semantic } = decision;
    if (decisionSha256 !== exchange.decisionSha256 || sha256(Buffer.from(canonicalJson(semantic), "utf8")) !== decisionSha256) fail("ANSWER_INVALID", "Exchange decision hash is invalid.", "Run prepare again; do not transplant an answer between exchanges.");
  }
  const answer = await readJson(resolve(exchangeRoot, "answer.json"), "ANSWER_INVALID");
  const answerSchema = await readJson(resolve(targetRoot, target.answerContract), "ANSWER_INVALID");
  const answerErrors = validate(answer, answerSchema);
  if (answerErrors.length) fail("ANSWER_INVALID", "Semantic answer violates its closed contract.", "Correct only answer.json in the same exchange.", answerErrors);

  // Output ownership must fail closed under concurrency; see "output lock rejects a second record without silent loss".
  const locks = resolve(projectRoot, ".skill-rails-next", "locks");
  const lock = resolve(locks, `${sha256(Buffer.from(target.declaredOutput, "utf8"))}.lock`);
  await ensureDirectory(locks);
  let acquired = false;
  try {
    try { await mkdir(lock); acquired = true; } catch (error) { if (error?.code === "EEXIST") fail("OUTPUT_BUSY", "Another record owns the output lock.", "Wait for the active record to finish, then initialize or prepare again; never break the lock automatically."); throw error; }
    await writeFile(resolve(lock, "owner.json"), `${canonicalJson({ schemaVersion: 1, projectRoot, output: target.declaredOutput, exchangeId: exchange.exchangeId, hostname: hostname(), pid: process.pid, createdAt: new Date().toISOString() })}\n`);
    if (hooks.afterLock) await hooks.afterLock({ lock });

    const currentInputs = [];
    for (const path of target.declaredInputs) currentInputs.push(basisPublic(await fileBasis(projectRoot, path)));
    const expectedInputs = new Map(exchange.basis.inputs.map((item) => [item.path, item]));
    // Raw-basis CAS keeps changed inputs distinct from output conflict; see "input stale and output conflict are distinct no-write results".
    for (const current of currentInputs) {
      if (current.path !== target.declaredOutput && !sameBasis(current, expectedInputs.get(current.path))) fail("INPUT_STALE", `${current.path} changed after the exchange was created.`, "Initialize or prepare again and re-evaluate the semantic answer.");
    }
    const currentOutput = await fileBasis(projectRoot, target.declaredOutput);
    const currentBytes = currentOutput.bytes ?? Buffer.alloc(0);
    const domainConfig = await readJson(resolve(targetRoot, target.domainConfig), "RENDER_FAILED");
    const rendererInput = Buffer.from(`${canonicalJson({ schemaVersion: 1, currentOutputBase64: currentBytes.toString("base64"), validatedAnswer: answer, domainConfig })}\n`, "utf8");
    const rendered = await runChild(process.execPath, [resolve(targetRoot, target.renderer)], rendererInput, "RENDER_FAILED");
    if (rendered.code !== 0) {
      const diagnostic = rendered.stderr.toString("utf8").trim();
      if (diagnostic === "MANAGED_REGION_INVALID") fail("MANAGED_REGION_INVALID", "Renderer found invalid managed-region bytes.", "Have a person decide how to repair the managed-region boundary.");
      fail("RENDER_FAILED", `Renderer failed: ${diagnostic || `exit ${rendered.code}`}`, "Inspect the renderer and retry without changing the answer semantics.");
    }
    assertFramePreserved(currentBytes, rendered.stdout);
    const desiredHash = sha256(rendered.stdout);
    const currentHash = sha256(currentBytes);
    if (Buffer.compare(rendered.stdout, currentBytes) === 0) return { schemaVersion: 1, status: "APPLIED_ALREADY", output: target.declaredOutput, currentSha256: currentHash, effect: "none" };
    if (!sameBasis(basisPublic(currentOutput), exchange.basis.output)) fail("OUTPUT_CONFLICT", `${target.declaredOutput} changed after the exchange was created.`, "Inspect the current output, then initialize or prepare again.");

    const { resolveProjectPath } = await import("./common.mjs");
    const output = await resolveProjectPath(projectRoot, target.declaredOutput);
    await ensureDirectory(dirname(output));
    const stage = resolve(dirname(output), `.${basename(output)}.skill-rails-next-${nonce()}.tmp`);
    try {
      await writeFile(stage, rendered.stdout);
      await rename(stage, output);
      if (hooks.afterReplace) await hooks.afterReplace({ output, desiredBytes: rendered.stdout });
    } finally {
      await rm(stage, { force: true });
    }
    // Only a post-replace reread can authorize an observed effect; see "post-write reread mismatch never claims observed effect".
    const reread = await readFile(output);
    const observedHash = sha256(reread);
    if (observedHash !== desiredHash) fail("APPLY_NOT_OBSERVED", "Output bytes after replace do not match the desired hash.", "Inspect the output file; do not claim that the effect was observed.", { authority: "attempted", desiredSha256: desiredHash, observedSha256: observedHash });
    return { schemaVersion: 1, status: "APPLIED", output: target.declaredOutput, sha256: observedHash, effect: { authority: "observed", operation: "file-reread" } };
  } finally {
    if (acquired) await rm(lock, { recursive: true, force: true });
  }
}
