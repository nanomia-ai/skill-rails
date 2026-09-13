#!/usr/bin/env node

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);

function output(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

try {
  const request = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (request?.schemaVersion !== 1 || !Array.isArray(request.inputs) || request?.domainConfig?.schemaVersion !== 1) throw new Error("invalid observer input");
  const inputs = new Map(request.inputs.map((item) => [item.path, item]));
  const facts = [];
  const unknowns = [];
  const plan = inputs.get("pilot/plan.md");
  const progress = inputs.get("pilot/progress.md");
  const verification = inputs.get("pilot/verification.md");
  const planMarker = plan?.state === "present" ? plan.text.match(/^<!-- skill-rails-next:fixture-plan cardId=([a-z0-9-]+) -->$/m) : null;
  if (planMarker?.[1] === request.domainConfig.cardId) facts.push({ id: "card-id", value: planMarker[1], basisPaths: ["pilot/plan.md"], authority: "machine-observed" });
  else unknowns.push({ id: "card-id", reasonCode: "FIXTURE_PLAN_FORMAT_UNKNOWN", basisPaths: ["pilot/plan.md"] });

  const progressMarker = progress?.state === "present" ? progress.text.match(/^<!-- skill-rails-next:fixture-progress cardId=([a-z0-9-]+) status=([a-z-]+) -->$/m) : null;
  if (progressMarker?.[1] === request.domainConfig.cardId && progressMarker?.[2] === "implemented") facts.push({ id: "implementation-status", value: "implemented", basisPaths: ["pilot/progress.md"], authority: "machine-observed" });
  else unknowns.push({ id: "implementation-status", reasonCode: "FIXTURE_PROGRESS_FORMAT_UNKNOWN", basisPaths: ["pilot/progress.md"] });

  facts.push({ id: "verification-command", value: request.domainConfig.verificationCommand, basisPaths: [], authority: "machine-observed" });
  facts.push({ id: "verification-output", value: verification?.state === "present" ? "present" : "absent", basisPaths: ["pilot/verification.md"], authority: "machine-observed" });
  facts.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  unknowns.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  output({ schemaVersion: 1, facts, unknowns });
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
