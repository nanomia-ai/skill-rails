import { resolve } from "node:path";
import { collectBasis, createExchange, readAnswerContract } from "./exchange.mjs";
import { ensureProject, fail, readJson } from "./common.mjs";

export async function initializeRecord(targetRoot, receipt, projectArgument) {
  const target = await readJson(resolve(targetRoot, "config", "target.json"));
  if (target.schemaVersion !== 1 || target.mode !== "record-only") fail("INITIALIZE_FAILED", "This target does not support record-only initialization.", "Use only the commands documented by this target entry.");
  const projectRoot = await ensureProject(projectArgument);
  const current = await collectBasis(projectRoot, target, { code: "INITIALIZE_FAILED", nextAction: "Correct the declared text input and initialize again." });
  const answerContract = await readAnswerContract(targetRoot, target);
  let created;
  try {
    created = await createExchange({ targetRoot, receipt, target, projectRoot, basis: current.basis, answerContract: answerContract.schema });
  } catch (error) {
    fail("INITIALIZE_FAILED", `Could not create the exchange: ${error.message}`, "Correct the project exchange directory and initialize again.");
  }
  return {
    schemaVersion: 1,
    status: "RECORD_INITIALIZED",
    exchange: created.exchangeRoot,
    inputs: current.inputLocators,
    output: current.outputLocator,
    domainConfig: resolve(targetRoot, target.domainConfig),
    answerContract: answerContract.path,
    answer: created.answerPath,
    recordCommand: created.recordCommand,
  };
}
