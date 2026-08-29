import { sha256 } from "../runtime/hash.mjs";
import { INTENT_ARRAYS } from "./profiles.mjs";
import { guidanceTopicPath, isJudgmentTopic } from "./guidance.mjs";

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
    ...INTENT_ARRAYS.filter((field) => field !== "judgment_points").flatMap((field) => intent[field].map((text, index) => atom(field, `intent.${field}[${index}]`, text, profile, index))),
    ...judgmentAtoms(intent.judgment_points, profile)
  ];
  return { schema: "skill-rails/obligation-ledger/2", intent_hash: sha256(intent), profile, atoms };
}

export function mergeObligationLedger(previous, intent, profile, changedFields = []) {
  const fresh = createObligationLedger(intent, profile);
  const prior = new Map((previous?.atoms ?? []).map((item) => [`${item.source}\0${item.text}`, item]));
  fresh.atoms = fresh.atoms.map((item) => {
    const field = item.source.match(/^intent\.([a-z_]+)/)?.[1];
    const existing = prior.get(`${item.source}\0${item.text}`);
    const legacySimpleProjection = previous?.schema === "skill-rails/obligation-ledger/1"
      && ["p0", "p1"].includes(profile)
      && !usesRetiredIntentProjection(existing);
    const compatibleProjection = previous?.schema === fresh.schema || profile === "p2" || legacySimpleProjection;
    if (existing && compatibleProjection) return { ...item, disposition: existing.disposition, targets: existing.targets, evidence: existing.evidence };
    if (profile === "p2" && field !== "description") return { ...item, disposition: "review-required", targets: [], evidence: [] };
    return item;
  });
  fresh.atoms.push(...(previous?.atoms ?? []).filter((item) => !String(item.source).startsWith("intent.")));
  if (previous?.migration) fresh.migration = previous.migration;
  return fresh;
}

function judgmentAtoms(items, profile) {
  return items.flatMap((item, index) => {
    if (!isJudgmentTopic(item)) return [atom("judgment_points", `intent.judgment_points[${index}]`, item, profile, index)];
    return [
      atom("judgment_points", `intent.judgment_points[${index}].when`, item.when, profile, index, {
        id: `judgment-topic-${item.id}-when`, candidateClass: "judgment/body", projection: { kind: "topic-when", topicId: item.id }
      }),
      ...item.points.map((point, pointIndex) => atom("judgment_points", `intent.judgment_points[${index}].points[${pointIndex}]`, point, profile, pointIndex, {
        id: `judgment-topic-${item.id}-point-${String(pointIndex + 1).padStart(3, "0")}`,
        projection: { kind: "topic-point", topicId: item.id }
      }))
    ];
  });
}

function usesRetiredIntentProjection(atom) {
  return [...(atom?.targets ?? []), ...(atom?.evidence ?? [])].includes("file:references/intent.md");
}

function atom(field, source, text, profile, index, options = {}) {
  const id = options.id ?? `${field.replaceAll("_", "-")}-${String(index + 1).padStart(3, "0")}`;
  const projected = projectedLocators(field, profile, index, options.projection);
  const requiresAuthoring = profile === "p2" ? !["description", "problem"].includes(field) : profile === "p1" && ["exact_formats", "deterministic_helpers"].includes(field);
  return {
    id, source, text, candidate_class: options.candidateClass ?? CLASS[field], consequence: consequence(field),
    disposition: requiresAuthoring ? "review-required" : "projected",
    targets: requiresAuthoring ? [] : projected.targets,
    evidence: requiresAuthoring ? [] : projected.evidence
  };
}

function projectedLocators(field, profile, index, projection = null) {
  if (profile === "p2") {
    if (field === "description") return { targets: ["file:SKILL.md", "file:agents/openai.yaml"], evidence: ["file:agents/openai.yaml"] };
    return { targets: ["body:why: purpose", "file:references/purpose.md"], evidence: ["body:why: purpose"] };
  }
  if (field === "description") return { targets: ["file:SKILL.md", "file:agents/openai.yaml"], evidence: ["file:SKILL.md"] };
  if (projection?.kind === "topic-when") return { targets: ["file:references/guidance-index.md"], evidence: ["file:references/guidance-index.md"] };
  if (projection?.kind === "topic-point") {
    const target = `file:${guidanceTopicPath(projection.topicId)}`;
    return { targets: [target], evidence: [target] };
  }
  const targets = ["file:SKILL.md"];
  const evidence = ["file:SKILL.md"];
  if (field === "use_cases") evidence.push(`eval:positive-${index + 1}`);
  if (field === "near_misses") evidence.push(`eval:near-miss-${index + 1}`);
  return { targets, evidence };
}

function consequence(field) {
  if (["irreversible_boundaries", "state_dependent_behaviors", "completion_evidence"].includes(field)) return "high";
  if (["near_misses", "inputs", "outputs", "exact_formats", "external_dependencies", "deterministic_helpers"].includes(field)) return "medium";
  return "low";
}
