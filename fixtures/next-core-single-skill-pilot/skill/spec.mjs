import { line } from "./scripts/skill-rails/dsl.mjs";

export const SPEC = { version: "5", id: "evidence-credit", profile: "single", imports: [] };
export const OBSERVATIONS = {
  "intent.token": { decided: true, domain: ["work", "verify"] },
  "verifier.channel": { collector: "evidence-credit/state.verifier-channel", domain: ["available", "unavailable"] },
  "task.identity": { collector: "evidence-credit/state.task-identity", domain: "text" },
  "task.snapshot": { collector: "evidence-credit/state.task-snapshot", domain: "text" },
  "selection.locator": { collector: "evidence-credit/state.selection-locator", domain: "text" },
  "selection.hash": { collector: "evidence-credit/state.selection-hash", domain: "text" },
  "continuation.identity": { collector: "evidence-credit/state.continuation-identity", domain: "text" },
  "result.verdict": { collector: "evidence-credit/state.result-verdict", domain: ["pass", "finding", "NONE"] },
  "result.task": { collector: "evidence-credit/state.result-task", domain: "text|NONE" },
  "result.snapshot": { collector: "evidence-credit/state.result-snapshot", domain: "text|NONE" },
  "result.selection": { collector: "evidence-credit/state.result-selection", domain: "text|NONE" },
  "result.selectionHash": { collector: "evidence-credit/state.result-selection-hash", domain: "text|NONE" },
  "result.continuation": { collector: "evidence-credit/state.result-continuation", domain: "text|NONE" },
  "result.currentness": { collector: "evidence-credit/state.result-currentness", domain: ["current", "stale", "NONE"] }
};
export const FORMATS = {
  verifierResult: line("verifier result", { task: "path", snapshot: "path", selection: "path", "selection-hash": "path", continuation: "path", verdict: ["pass", "finding"], "recorded-json": "json" })
};
export const TEMPLATES = {
  laneReport: { file: "templates/lane-report.md", fields: { status: "line", reference: "line", evidence: "block" }, sections: ["## Evidence"] }
};
export const ORDERS = {};
export const OWNERSHIP = { "state/verifier-result.log": "evidence-credit" };
export const GUARDS = [
  { id: "work-prose-isolation", reads: ["intent.token"], when: s => s.intent.token === "work", then: "RESTRICT", forbids: ["RUN", "WRITE", "DISPATCH"], body: "guard: work-prose-isolation" }
];
export const STAGES = [
  { id: "work", reads: ["intent.token"], done: s => s.intent.token !== "work", record: { kind: "message", message: "work-guidance" }, effects: [["REPORT", { template: "laneReport", reference: "references/work.md", token: "work" }], "DONE"], body: "stage: work" },
  { id: "channel", reads: ["intent.token", "verifier.channel"], done: s => s.intent.token !== "verify" || s.verifier.channel === "available", record: { kind: "message", message: "verifier-channel" }, effects: ["WAIT"], body: "stage: channel" },
  { id: "acquire", reads: ["intent.token", "result.verdict"], done: s => s.intent.token !== "verify" || s.result.verdict !== "NONE", record: { kind: "file", artifact: "verifierResult" }, effects: [["RUN", { action: "acquire-channel", channel: "verifier", input: "state/verifier-channel.json" }], ["DISPATCH", { action: "dispatch-verifier", role: "verifier" }], ["WRITE", { action: "record-result", artifact: "verifierResult", format: "verifierResult" }], "NEXT"], body: "stage: acquire" },
  { id: "evidence", reads: ["intent.token"], done: s => s.intent.token !== "verify", reentry: "rejudge", table: "evidence", branches: {
    "stale-proof": ["BLOCK"],
    "mismatched-proof": ["BLOCK"],
    "matching-finding": [["REPORT", { template: "laneReport", reference: "references/verify.md", result: "finding" }], "BLOCK"],
    "matching-pass": [["REPORT", { template: "laneReport", reference: "references/verify.md", result: "pass" }], "DONE"],
    "BLOCK:evidence-unclassified": ["BLOCK"]
  }, body: "stage: evidence" }
];
export const TABLES = {
  evidence: { exclusive: true, rows: [
    { state: "stale-proof", reads: ["result.currentness"], when: s => s.result.currentness === "stale" },
    { state: "mismatched-proof", reads: ["result.currentness", "result.task", "task.identity", "result.snapshot", "task.snapshot", "result.selection", "selection.locator", "result.selectionHash", "selection.hash", "result.continuation", "continuation.identity"], when: s => s.result.currentness === "current" && (s.result.task !== s.task.identity || s.result.snapshot !== s.task.snapshot || s.result.selection !== s.selection.locator || s.result.selectionHash !== s.selection.hash || s.result.continuation !== s.continuation.identity) },
    { state: "matching-finding", reads: ["result.currentness", "result.task", "task.identity", "result.snapshot", "task.snapshot", "result.selection", "selection.locator", "result.selectionHash", "selection.hash", "result.continuation", "continuation.identity", "result.verdict"], when: s => s.result.currentness === "current" && s.result.task === s.task.identity && s.result.snapshot === s.task.snapshot && s.result.selection === s.selection.locator && s.result.selectionHash === s.selection.hash && s.result.continuation === s.continuation.identity && s.result.verdict === "finding" },
    { state: "matching-pass", reads: ["result.currentness", "result.task", "task.identity", "result.snapshot", "task.snapshot", "result.selection", "selection.locator", "result.selectionHash", "selection.hash", "result.continuation", "continuation.identity", "result.verdict"], when: s => s.result.currentness === "current" && s.result.task === s.task.identity && s.result.snapshot === s.task.snapshot && s.result.selection === s.selection.locator && s.result.selectionHash === s.selection.hash && s.result.continuation === s.continuation.identity && s.result.verdict === "pass" },
    { state: "BLOCK:evidence-unclassified", reads: [], when: () => true }
  ] }
};
export const ARTIFACTS = {
  verifierResult: { path: "state/verifier-result.log", writer: "evidence-credit", readers: ["stage.acquire", "stage.evidence"], update: "append", template: null }
};
export const ROLES = {
  verifier: { inputs: ["task", "snapshot", "selection", "continuation"], reads: ["task", "snapshot", "selection", "continuation"], effects: [], judgments: { verdict: ["pass", "finding"] }, returns: "laneReport", body: "role: verifier" }
};
export const READ_FIRST = [{ body: "why: purpose", path: "references/canon.md" }];
export const DECLARATIONS = {
  complexityBudget: { value: { maxStages: 6 }, consumer: "lint:L6" }
};
export const DEFERRED = [];
