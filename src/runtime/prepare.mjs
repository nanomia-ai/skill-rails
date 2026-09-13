import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { basisPublic, canonicalJson, compareCodePoint, decodeUtf8, ensureDirectory, ensureProject, fail, fileBasis, nonce, readJson, runChild, sha256, validate } from "./common.mjs";

function answerSkeleton(schema) {
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

function packetMarkdown(decision, answerPath, answerContractPath, recordCommand) {
  const observed = [
    ...decision.observed.facts.map((fact) => `- ${fact.id}: \`${canonicalJson(fact.value)}\` (${fact.authority}; basis: ${fact.basisPaths.join(", ") || "static config"})`),
    ...decision.observed.unknowns.map((item) => `- ${item.id}: unknown (${item.reasonCode}; basis: ${item.basisPaths.join(", ") || "none"})`),
  ];
  const reads = decision.reads.map((item) => `- \`${item.path}\`: ${item.reason}`);
  const criteria = decision.judgment.criteria.map((item) => `- ${item}`);
  const done = decision.completionCriteria.map((item) => `- ${item}`);
  return [
    "# Prepared work",
    "",
    "## Purpose", decision.purpose, "",
    "## Observed", ...(observed.length ? observed : ["- No machine-observed facts; required meaning remains unknown."]), "",
    "## Do now", decision.action, "",
    "## Judgment", decision.judgment.question, "", ...criteria, `- Criteria owner: \`${decision.judgment.owner}\``, "",
    "## Read", ...(reads.length ? reads : ["- No additional read is declared."]), "",
    "## Return", `Fill \`${answerPath}\`.`, `- Answer contract: \`${answerContractPath}\``, `- Semantic fields: \`schemaVersion\`, \`cardId\`, \`verdict\`, \`summary\`, \`checks[].{name,outcome,evidence[]}\`, and \`unknowns\`.`, "",
    "## Done when", ...done, "",
    "## Authority and recovery",
    "- Semantic fields are AI-reported; the packet does not prove their truth.",
    "- File effect is proven only by record's post-write reread hash.",
    "- On stale or conflict, re-run prepare and re-evaluate. Do not transplant the old answer.",
    `- Record exactly with: \`${recordCommand}\``,
    "",
  ].join("\n");
}

export async function prepare(targetRoot, receipt, projectArgument) {
  const target = await readJson(resolve(targetRoot, "config", "target.json"));
  if (target.schemaVersion !== 1 || target.mode !== "prepare-record") fail("PREPARE_FAILED", "This target does not support prepare.", `Open ${target.fallbackReference ?? "the target entry"} for the available fallback.`);
  const projectRoot = await ensureProject(projectArgument);
  const domainConfig = await readJson(resolve(targetRoot, target.domainConfig), "PREPARE_FAILED");
  const packetKernel = await readJson(resolve(targetRoot, target.packet), "PREPARE_FAILED");
  const answerContractPath = resolve(targetRoot, target.answerContract);
  const answerContractBytes = await readFile(answerContractPath);
  const answerContract = JSON.parse(answerContractBytes.toString("utf8"));
  const inputs = [];
  for (const logicalPath of target.declaredInputs) {
    const basis = await fileBasis(projectRoot, logicalPath);
    inputs.push({ ...basisPublic(basis), text: basis.bytes === null ? null : decodeUtf8(basis.bytes, logicalPath) });
  }
  const outputBasis = basisPublic(await fileBasis(projectRoot, target.declaredOutput));
  const observerInput = Buffer.from(`${canonicalJson({ schemaVersion: 1, inputs, domainConfig })}\n`, "utf8");
  const observer = await runChild(process.execPath, [resolve(targetRoot, target.observer)], observerInput, "PREPARE_FAILED");
  if (observer.code !== 0) fail("PREPARE_FAILED", `Observer failed: ${observer.stderr.toString("utf8").trim() || `exit ${observer.code}`}`, `Open ${resolve(targetRoot, target.fallbackReference)} and record this run as fallback.`);
  let observed;
  try { observed = JSON.parse(decodeUtf8(observer.stdout, "observer stdout")); } catch { fail("PREPARE_FAILED", "Observer did not return one JSON object.", `Open ${resolve(targetRoot, target.fallbackReference)} and record this run as fallback.`); }
  const observedSchema = await readJson(resolve(targetRoot, "contracts", "observed-facts.schema.json"), "PREPARE_FAILED");
  const observedErrors = validate(observed, observedSchema);
  const rows = [...(observed.facts ?? []), ...(observed.unknowns ?? [])];
  const ids = rows.map((item) => item.id);
  const factsSorted = (observed.facts ?? []).map((item) => item.id).join("\0") === [...(observed.facts ?? [])].map((item) => item.id).sort(compareCodePoint).join("\0");
  const unknownsSorted = (observed.unknowns ?? []).map((item) => item.id).join("\0") === [...(observed.unknowns ?? [])].map((item) => item.id).sort(compareCodePoint).join("\0");
  if (observedErrors.length || new Set(ids).size !== ids.length || !factsSorted || !unknownsSorted) fail("PREPARE_FAILED", "Observer output violates ObservedFactsV1 ordering or schema.", `Open ${resolve(targetRoot, target.fallbackReference)} and record this run as fallback.`, observedErrors);
  const declared = new Set(target.declaredInputs);
  for (const row of rows) for (const path of row.basisPaths) if (!declared.has(path)) fail("PREPARE_FAILED", `Observer cited undeclared basis ${path}.`, `Open ${resolve(targetRoot, target.fallbackReference)} and record this run as fallback.`);

  const purposeImport = target.imports.find((item) => item.id === packetKernel.purposeModule);
  if (!purposeImport) fail("PREPARE_FAILED", "Packet purpose module is not materialized.", `Open ${resolve(targetRoot, target.fallbackReference)} and record this run as fallback.`);
  const purposeBytes = await readFile(resolve(targetRoot, purposeImport.path));
  const purpose = decodeUtf8(purposeBytes, purposeImport.path).trim();
  const semantic = {
    schemaVersion: 1,
    target: { packageId: receipt.packageId, packageVersion: receipt.packageVersion, targetId: receipt.targetId, receiptTreeSha256: receipt.treeSha256 },
    basis: { inputs: inputs.map(({ text: _text, ...basis }) => basis), output: outputBasis },
    observed,
    purpose,
    purposeSha256: sha256(purposeBytes),
    action: packetKernel.action,
    judgment: { question: packetKernel.judgment.question, criteria: packetKernel.judgment.criteria, owner: target.packet },
    reads: packetKernel.reads,
    returnContract: target.answerContract,
    returnContractSha256: sha256(answerContractBytes),
    completionCriteria: packetKernel.doneWhen,
    authority: { semanticAnswer: "ai-reported", fileEffect: "unproven-until-record-reread" },
    fallbackEligible: Boolean(target.fallbackReference),
  };
  const decisionSha256 = sha256(Buffer.from(canonicalJson(semantic), "utf8"));
  const decision = { ...semantic, decisionSha256 };
  const preparedSchema = await readJson(resolve(targetRoot, "contracts", "prepared-work.schema.json"), "PREPARE_FAILED");
  const preparedErrors = validate(decision, preparedSchema);
  if (preparedErrors.length) fail("PREPARE_FAILED", "PreparedWorkV1 violates its contract.", `Open ${resolve(targetRoot, target.fallbackReference)} and record this run as fallback.`, preparedErrors);

  const exchangeId = nonce();
  const exchangeParent = resolve(projectRoot, ".skill-rails-next", "exchanges");
  const exchangeRoot = resolve(exchangeParent, exchangeId);
  const stage = resolve(exchangeParent, `.stage-${exchangeId}`);
  await ensureDirectory(exchangeParent);
  const recordCommand = `node ${JSON.stringify(resolve(targetRoot, "scripts", "run.mjs"))} record --exchange ${JSON.stringify(exchangeRoot)}`;
  const exchange = {
    schemaVersion: 1,
    exchangeId,
    projectRoot,
    targetRoot,
    targetId: receipt.targetId,
    receiptTreeSha256: receipt.treeSha256,
    decisionSha256,
    basis: semantic.basis,
    declaredOutput: target.declaredOutput,
  };
  try {
    await mkdir(stage);
    const answerPath = resolve(exchangeRoot, "answer.json");
    await writeFile(resolve(stage, "decision.json"), `${canonicalJson(decision)}\n`);
    await writeFile(resolve(stage, "exchange.json"), `${canonicalJson(exchange)}\n`);
    await writeFile(resolve(stage, "answer.json"), `${canonicalJson(answerSkeleton(answerContract))}\n`);
    await writeFile(resolve(stage, "packet.md"), packetMarkdown(decision, answerPath, answerContractPath, recordCommand));
    await rename(stage, exchangeRoot);
  } catch (error) {
    await rm(stage, { recursive: true, force: true });
    fail("PREPARE_FAILED", `Could not create the exchange: ${error.message}`, `Open ${resolve(targetRoot, target.fallbackReference)} and record this run as fallback.`);
  }
  return { schemaVersion: 1, status: "PREPARED", packet: resolve(exchangeRoot, "packet.md"), answer: resolve(exchangeRoot, "answer.json"), recordCommand, decisionSha256 };
}
