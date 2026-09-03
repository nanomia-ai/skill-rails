export const EXPORT_NAMES = Object.freeze([
  "SPEC",
  "OBSERVATIONS",
  "FORMATS",
  "TEMPLATES",
  "ORDERS",
  "OWNERSHIP",
  "GUARDS",
  "STAGES",
  "TABLES",
  "ARTIFACTS",
  "ROLES",
  "READ_FIRST",
  "DECLARATIONS",
  "DEFERRED"
]);

export const EFFECT_VERBS = Object.freeze(["READ", "RUN", "WRITE", "COMMIT", "DISPATCH", "REPORT"]);
export const TERMINALS = Object.freeze(["NEXT", "ASK", "WAIT", "BLOCK", "DONE"]);
export const DECISION_STATUSES = Object.freeze(["ASK", "WAIT", "ROUTE", "BLOCK", "DONE", "NEXT"]);
export const TRACE_AUTHORITIES = Object.freeze([
  "runtime_observed",
  "harness_observed",
  "artifact_verified",
  "agent_claimed",
  "human_confirmed"
]);

export const TRACE_TYPES = Object.freeze([
  "spec_loaded",
  "snapshot_started",
  "observation_collected",
  "observation_unknown",
  "snapshot_stable",
  "snapshot_stale",
  "guard_evaluated",
  "guard_matched",
  "decision_emitted",
  "guide_rendered",
  "stage_entered",
  "effect_planned",
  "effect_claimed",
  "effect_observed",
  "artifact_verified",
  "receipt_recorded",
  "proof_recorded",
  "stage_verified",
  "stage_exited",
  "review_required"
]);

export const DECISION_SCHEMA = "urn:nanomia:skill-contract:decision:2";
export const TRACE_SCHEMA = "urn:nanomia:skill-contract:trace-event:1";
export const MINIMUM_NODE_MAJOR = 20;
export const VALIDATOR_VERSION = "0.5.0";
export const RUNTIME_VERSION = "0.3.2";
export const KERNEL_VERSION = "6";

export const PLACEHOLDER_KINDS = Object.freeze(["line", "block", "list", "generated"]);
export const BODY_KINDS = Object.freeze(["guard", "stage", "role", "why"]);

export const DIAGNOSTIC_LEVELS = Object.freeze(["error", "warning", "info"]);
