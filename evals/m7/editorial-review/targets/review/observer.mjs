#!/usr/bin/env node

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);

try {
  const request = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (request?.schemaVersion !== 1 || !Array.isArray(request.inputs) || request?.domainConfig?.schemaVersion !== 1) throw new Error("invalid observer input");
  const inputs = new Map(request.inputs.map((item) => [item.path, item]));
  const facts = [];
  const unknowns = [];
  const audience = inputs.get("review/audience.md");
  const decisions = inputs.get("review/decisions.md");
  const draft = inputs.get("review/draft.md");
  const marker = draft?.state === "present" ? draft.text.match(/^<!-- editorial-review:document id=([a-z0-9-]+) -->$/m) : null;

  facts.push({ id: "audience-input", value: audience?.state === "present" ? "present" : "absent", basisPaths: ["review/audience.md"], authority: "machine-observed" });
  facts.push({ id: "decision-output", value: decisions?.state === "present" ? "present" : "absent", basisPaths: ["review/decisions.md"], authority: "machine-observed" });
  facts.push({ id: "draft-input", value: draft?.state === "present" ? "present" : "absent", basisPaths: ["review/draft.md"], authority: "machine-observed" });
  if (marker?.[1] === request.domainConfig.documentId) facts.push({ id: "document-id", value: marker[1], basisPaths: ["review/draft.md"], authority: "machine-observed" });
  else unknowns.push({ id: "document-id", reasonCode: "DOCUMENT_MARKER_UNKNOWN", basisPaths: ["review/draft.md"] });

  facts.sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
  unknowns.sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
  process.stdout.write(`${JSON.stringify({ schemaVersion: 1, facts, unknowns })}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
