const PROFILE_VALUES = new Set(["auto", "p0", "p1", "p2"]);

export function validateIntent(intent) {
  const issues = [];
  if (!intent || typeof intent !== "object" || Array.isArray(intent)) issues.push("intent must be an object");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(intent?.name ?? "")) issues.push("name must be kebab-case");
  if (typeof intent?.description !== "string" || intent.description.trim().length < 20) issues.push("description must explain behavior and trigger conditions");
  if (typeof intent?.problem !== "string" || intent.problem.trim().length === 0) issues.push("problem is required");
  for (const field of INTENT_ARRAYS.filter((item) => item !== "judgment_points")) {
    if (!Array.isArray(intent?.[field])) issues.push(`${field} must be an array`);
    else if (intent[field].some((item) => typeof item !== "string" || item.trim().length === 0)) issues.push(`${field} entries must be non-empty strings`);
  }
  validateJudgmentPoints(intent?.judgment_points, issues);
  const allowed = new Set(["name", "description", "problem", ...INTENT_ARRAYS]);
  for (const field of Object.keys(intent ?? {})) if (!allowed.has(field)) issues.push(`unknown intent field: ${field}`);
  return issues;
}

function validateJudgmentPoints(value, issues) {
  if (!Array.isArray(value)) {
    issues.push("judgment_points must be an array");
    return;
  }
  const ids = new Set();
  for (const [index, item] of value.entries()) {
    if (typeof item === "string") {
      if (item.trim().length === 0) issues.push(`judgment_points[${index}] must be a non-empty string or guidance topic`);
      continue;
    }
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      issues.push(`judgment_points[${index}] must be a non-empty string or guidance topic`);
      continue;
    }
    const keys = Object.keys(item).sort();
    if (keys.join("\0") !== ["id", "points", "when"].sort().join("\0")) issues.push(`judgment_points[${index}] guidance topic must contain exactly id, when, and points`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id ?? "")) issues.push(`judgment_points[${index}].id must be kebab-case`);
    else if (ids.has(item.id)) issues.push(`judgment_points guidance topic id is duplicated: ${item.id}`);
    else ids.add(item.id);
    if (typeof item.when !== "string" || item.when.trim().length === 0 || /[\r\n]/.test(item.when)) issues.push(`judgment_points[${index}].when must be a non-empty single-line condition`);
    if (!Array.isArray(item.points) || item.points.length === 0 || item.points.some((point) => typeof point !== "string" || point.trim().length === 0)) issues.push(`judgment_points[${index}].points must contain one or more non-empty strings`);
  }
}

export function selectProfile(intent, requested = "auto") {
  if (!PROFILE_VALUES.has(requested)) throw new Error(`Unknown profile: ${requested}`);
  const signals = profileSignals(intent);
  if (requested !== "auto") return { profile: requested, signals, explicit: true };
  const stateful = signals.filter((item) => item.profile === "p2");
  const helpers = signals.filter((item) => item.profile === "p1");
  const profile = stateful.length > 0 ? "p2" : helpers.length > 0 ? "p1" : "p0";
  return { profile, signals, explicit: false };
}

export function profileSignals(intent) {
  const values = (field) => Array.isArray(intent?.[field]) ? intent[field] : [];
  const output = [];
  add(output, "state-dependent-behavior", values("state_dependent_behaviors"), "p2");
  add(output, "irreversible-boundary", values("irreversible_boundaries"), "p2");
  add(output, "deterministic-helper", values("deterministic_helpers"), "p1");
  add(output, "exact-format", values("exact_formats"), values("state_dependent_behaviors").length > 0 ? "p2" : "p1");
  return output;
}

function add(output, kind, values, profile) {
  if (values.length > 0) output.push({ kind, profile, count: values.length });
}

export const INTENT_ARRAYS = Object.freeze([
  "use_cases", "near_misses", "inputs", "outputs", "irreversible_boundaries", "state_dependent_behaviors",
  "exact_formats", "external_dependencies", "completion_evidence", "judgment_points", "deterministic_helpers"
]);
