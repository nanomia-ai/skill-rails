import { line } from "./scripts/skill-rails/dsl.mjs";

export const SPEC = { version: "5", id: "review-flow", profile: "single", imports: [] };
export const OBSERVATIONS = {
  "signal.pass": { collector: "review-flow/fixture.signal-pass", domain: ["yes", "no"] },
  "review.lastVerdict": { collector: "review-flow/fixture.review-last-verdict", domain: ["pass", "finding", "unverified", "mystery", "NONE"] },
  "review.lastTarget": { collector: "review-flow/fixture.review-last-target", domain: ["code", "card-contract", "NONE"] },
  "review.ordinal": { collector: "review-flow/fixture.review-ordinal", domain: "integer" },
  "review.disposition": { collector: "review-flow/fixture.review-disposition", domain: ["present", "NONE"] },
  "artifact.reviewLogPresent": { collector: "review-flow/fixture.review-log-present", domain: ["yes", "no"] },
  "session.readOnly": { collector: "review-flow/fixture.session-read-only", domain: ["yes", "no"] }
};
export const FORMATS = {
  reviewResult: line("review result", { head: "hex40", verdict: ["pass", "finding", "unverified"] })
};
export const TEMPLATES = {
  report: { file: "templates/review-report.md", fields: { status: "line", evidence: "block" }, sections: ["## Evidence"] }
};
export const ORDERS = {};
export const OWNERSHIP = { "state/signal.log": "review-flow", "state/review.log": "review-flow" };
export const GUARDS = [
  { id: "read-only-session", reads: ["session.readOnly"], when: s => s.session.readOnly === "yes", then: "RESTRICT", forbids: ["WRITE", "DISPATCH"], body: "guard: read-only-session" }
];
export const STAGES = [
  { id: "signal", reads: ["signal.pass"], done: s => s.signal.pass === "yes", record: { kind: "file", artifact: "signalRecord" }, effects: [["RUN", { check: "completion" }], ["WRITE", { artifact: "signalRecord" }], "NEXT"], body: "stage: signal" },
  { id: "review", reads: ["review.lastVerdict", "artifact.reviewLogPresent"], done: s => s.review.lastVerdict === "pass" && s.artifact.reviewLogPresent === "yes", record: { kind: "file", artifact: "reviewLog" }, table: "review", cycle: { counter: "review.ordinal", boundedBy: "broken-record" }, branches: {
    open: [["DISPATCH", { role: "reviewer" }], "NEXT"],
    "broken-record": ["ASK"],
    replan: ["ROUTE:planning"],
    undecided: ["BLOCK"],
    continue: [["WRITE", { artifact: "reviewLog", format: "reviewResult" }], "NEXT"],
    unreviewed: [["DISPATCH", { role: "reviewer" }], ["WRITE", { artifact: "reviewLog", format: "reviewResult" }], "NEXT"]
  }, body: "stage: review" },
  { id: "route", reads: [], done: () => false, reentry: "rejudge", effects: [["REPORT", { template: "report" }], "DONE"], body: "stage: route" }
];
export const TABLES = {
  review: { exclusive: false, rows: [
    { state: "open", reads: ["review.lastVerdict", "review.lastTarget"], when: s => s.review.lastVerdict === "finding" && s.review.lastTarget === "code" },
    { state: "broken-record", reads: ["review.lastVerdict", "review.lastTarget", "review.ordinal", "review.disposition"], when: s => s.review.lastVerdict === "finding" && s.review.lastTarget === "code" && s.review.ordinal >= 3 && s.review.disposition === "NONE" },
    { state: "replan", reads: ["review.lastVerdict", "review.lastTarget"], when: s => s.review.lastVerdict === "finding" && s.review.lastTarget === "card-contract" },
    { state: "undecided", reads: ["review.lastVerdict"], when: s => s.review.lastVerdict === "unverified" },
    { state: "continue", reads: ["review.lastVerdict", "artifact.reviewLogPresent"], when: s => s.review.lastVerdict === "pass" && s.artifact.reviewLogPresent === "no" },
    { state: "unreviewed", reads: ["review.lastVerdict"], when: s => s.review.lastVerdict === "NONE" }
  ] }
};
export const ARTIFACTS = {
  signalRecord: { path: "state/signal.log", writer: "review-flow", readers: ["stage.signal"], update: "append", template: null },
  reviewLog: { path: "state/review.log", writer: "review-flow", readers: [], update: "append", template: null }
};
export const ROLES = {
  reviewer: { inputs: ["diff", "contract"], reads: ["diff", "contract"], effects: [], judgments: { verdict: ["pass", "finding", "unverified"] }, returns: "report", body: "role: reviewer" }
};
export const READ_FIRST = [{ body: "why: purpose", path: "references/purpose.md" }];
export const DECLARATIONS = { complexityBudget: { value: { maxStages: 12 }, consumer: "lint:L6" } };
export const DEFERRED = [];
