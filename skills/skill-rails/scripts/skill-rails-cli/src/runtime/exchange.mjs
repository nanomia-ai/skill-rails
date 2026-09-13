import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { basisPublic, canonicalJson, decodeUtf8, ensureDirectory, fileBasis, nonce, resolveProjectPath } from "./common.mjs";

export function answerSkeleton(schema) {
  const value = {};
  for (const key of schema.required ?? []) {
    const rule = schema.properties?.[key] ?? {};
    if (Object.hasOwn(rule, "const")) value[key] = rule.const;
    else if (rule.type === "array") value[key] = [];
    else if (rule.type === "object") value[key] = answerSkeleton(rule);
    else value[key] = null;
  }
  return value;
}

export async function collectBasis(projectRoot, target, textFailure) {
  const inputs = [];
  const locators = [];
  for (const logicalPath of target.declaredInputs) {
    const basis = await fileBasis(projectRoot, logicalPath);
    if (basis.bytes !== null && textFailure) decodeUtf8(basis.bytes, logicalPath, textFailure);
    inputs.push(basisPublic(basis));
    locators.push({ path: logicalPath, absolutePath: await resolveProjectPath(projectRoot, logicalPath), state: basis.state });
  }
  return {
    basis: { inputs, output: basisPublic(await fileBasis(projectRoot, target.declaredOutput)) },
    inputLocators: locators,
    outputLocator: { path: target.declaredOutput, absolutePath: await resolveProjectPath(projectRoot, target.declaredOutput) },
  };
}

export async function createExchange({ targetRoot, receipt, target, projectRoot, basis, answerContract, extraFields = {}, extraFiles = {} }) {
  const exchangeId = nonce();
  const exchangeParent = resolve(projectRoot, ".skill-rails-next", "exchanges");
  const exchangeRoot = resolve(exchangeParent, exchangeId);
  const stage = resolve(exchangeParent, `.stage-${exchangeId}`);
  const answerPath = resolve(exchangeRoot, "answer.json");
  const recordCommand = `node ${JSON.stringify(resolve(targetRoot, "scripts", "run.mjs"))} record --exchange ${JSON.stringify(exchangeRoot)}`;
  const exchange = {
    schemaVersion: 1,
    mode: target.mode,
    exchangeId,
    projectRoot,
    targetRoot,
    packageId: receipt.packageId,
    packageVersion: receipt.packageVersion,
    targetId: receipt.targetId,
    receiptTreeSha256: receipt.treeSha256,
    declaredOutput: target.declaredOutput,
    basis,
    ...extraFields,
  };
  await ensureDirectory(exchangeParent);
  try {
    await mkdir(stage);
    await writeFile(resolve(stage, "exchange.json"), `${canonicalJson(exchange)}\n`);
    await writeFile(resolve(stage, "answer.json"), `${canonicalJson(answerSkeleton(answerContract))}\n`);
    for (const [path, contents] of Object.entries(extraFiles)) {
      const value = typeof contents === "function" ? contents({ exchangeRoot, answerPath, recordCommand }) : contents;
      await writeFile(resolve(stage, path), value);
    }
    await rename(stage, exchangeRoot);
  } catch (error) {
    await rm(stage, { recursive: true, force: true });
    throw error;
  }
  return { exchangeRoot, answerPath, recordCommand };
}

export async function readAnswerContract(targetRoot, target) {
  const path = resolve(targetRoot, target.answerContract);
  const bytes = await readFile(path);
  return { path, bytes, schema: JSON.parse(bytes.toString("utf8")) };
}
