import { sha256 } from "../runtime/hash.mjs";
import { INTENT_ARRAYS } from "./profiles.mjs";

const CLASS = Object.freeze({
  description: "trigger", problem: "judgment/body", use_cases: "example", near_misses: "guard",
  inputs: "observation", outputs: "artifact", irreversible_boundaries: "guard",
  state_dependent_behaviors: "stage", exact_formats: "format", external_dependencies: "collector",
  completion_evidence: "stage/done/evidence", judgment_points: "judgment/body", deterministic_helpers: "declaration"
});

export function createObligationLedger(intent, profile) {
  const atoms = [
    atom("description", "intent.description", intent.description, profile, 0),
    atom("problem", "intent.problem", intent.problem, profile, 0),
    ...INTENT_ARRAYS.flatMap((field) => intent[field].map((text, index) => atom(field, `intent.${field}[${index}]`, text, profile, index)))
  ];
  return { schema: "skill-rails/obligation-ledger/1", intent_hash: sha256(intent), profile, atoms };
}

export function mergeObligationLedger(previous, intent, profile, changedFields = []) {
  const fresh = createObligationLedger(intent, profile);
  const changed = new Set(changedFields);
  const prior = new Map((previous?.atoms ?? []).map((item) => [`${item.source}\0${item.text}`, item]));
  fresh.atoms = fresh.atoms.map((item) => {
    const field = item.source.slice("intent.".length).split("[")[0];
    const existing = prior.get(`${item.source}\0${item.text}`);
    if (existing && !changed.has(field)) return { ...item, disposition: existing.disposition, targets: existing.targets, evidence: existing.evidence };
    if (profile === "p2" && field !== "description") return { ...item, disposition: "review-required", targets: [], evidence: [] };
    return item;
  });
  fresh.atoms.push(...(previous?.atoms ?? []).filter((item) => !String(item.source).startsWith("intent.")));
  if (previous?.migration) fresh.migration = previous.migration;
  return fresh;
}

function atom(field, source, text, profile, index) {
  const id = `${field.replaceAll("_", "-")}-${String(index + 1).padStart(3, "0")}`;
  const projected = projectedLocators(field, profile, index);
  const requiresAuthoring = profile === "p2" ? !["description", "problem"].includes(field) : profile === "p1" && ["exact_formats", "deterministic_helpers"].includes(field);
  return {
    id, source, text, candidate_class: CLASS[field], consequence: consequence(field),
    disposition: requiresAuthoring ? "review-required" : "projected",
    targets: requiresAuthoring ? [] : projected.targets,
    evidence: requiresAuthoring ? [] : projected.evidence
  };
}

function projectedLocators(field, profile, index) {
  if (profile === "p2") {
    if (field === "description") return { targets: ["file:SKILL.md", "file:agents/openai.yaml"], evidence: ["file:agents/openai.yaml"] };
    return { targets: ["body:why: purpose", "file:references/purpose.md"], evidence: ["body:why: purpose"] };
  }
  const targets = ["file:SKILL.md", "file:references/intent.md"];
  const evidence = ["file:references/intent.md"];
  if (field === "use_cases") evidence.push(`eval:positive-${index + 1}`);
  if (field === "near_misses") evidence.push(`eval:near-miss-${index + 1}`);
  return { targets, evidence };
}

function consequence(field) {
  if (["irreversible_boundaries", "state_dependent_behaviors", "completion_evidence"].includes(field)) return "high";
  if (["near_misses", "inputs", "outputs", "exact_formats", "external_dependencies", "deterministic_helpers"].includes(field)) return "medium";
  return "low";
}
