import { sha256 } from "./hash.mjs";
import { traceIntegrityIssues } from "./trace-store.mjs";

const STRONG = new Set(["runtime_observed", "harness_observed", "artifact_verified"]);

export function alignDecision(decision, events) {
  const integrity = traceIntegrityIssues(events);
  if (integrity.length > 0) return report(decision, "misaligned", [], integrity.map((item) => ({ ...item, critical: true })));
  const scoped = [...events].sort((a, b) => a.sequence - b.sequence).filter((event) => event.decision_id === decision.decision_id);
  if (scoped.some((event) => event.spec_fingerprint && event.spec_fingerprint !== decision.spec.fingerprint) || scoped.some((event) => event.snapshot_fingerprint && event.snapshot_fingerprint !== decision.snapshot.fingerprint)) {
    return report(decision, "stale", [], [{ code: "fingerprint-mismatch" }]);
  }
  const emission = judgeExpectation({ id: "decision:emitted", kind: "decision" }, scoped);
  const expectations = [];
  for (const [index, effect] of decision.effects.entries()) {
    if (!Array.isArray(effect)) continue;
    expectations.push({ id: `effect:${index}:${effect[0]}`, kind: "effect", index, verb: effect[0] });
  }
  for (const [index, proof] of decision.proof_required.entries()) if (proof.kind !== "effect") expectations.push({ id: `proof:${index}:${proof.kind}`, kind: "proof", proof });

  const behaviorVerdicts = expectations.map((expectation) => judgeExpectation(expectation, scoped));
  const verdicts = [emission, ...behaviorVerdicts];
  const issues = unexpectedEffects(decision, scoped);
  const hasViolation = behaviorVerdicts.some((item) => item.verdict === "violated");
  const hasUnproven = behaviorVerdicts.some((item) => item.verdict === "unproven");
  const hasSatisfied = behaviorVerdicts.some((item) => item.verdict === "satisfied");
  const criticalViolation = emission.verdict === "violated" || behaviorVerdicts.some((item) => item.verdict === "violated" && item.critical) || issues.some((item) => item.critical);
  const aggregate = criticalViolation ? "misaligned"
    : emission.verdict !== "satisfied" ? "unproven"
      : hasViolation || issues.length > 0 || (hasUnproven && hasSatisfied) ? "partial" : hasUnproven ? "unproven" : "aligned";
  return report(decision, aggregate, verdicts, issues);
}

function unexpectedEffects(decision, events) {
  const planned = new Map(decision.effects.flatMap((effect, index) => Array.isArray(effect) ? [[index, effect[0]]] : []));
  const observed = events.filter((event) => event.type === "effect_observed" && STRONG.has(event.authority));
  const claimed = events.filter((event) => event.type === "effect_claimed");
  const duplicates = new Map();
  for (const event of observed) {
    const key = `${event.data?.index}:${event.data?.verb}`;
    if (!duplicates.has(key)) duplicates.set(key, []);
    duplicates.get(key).push(event.event_id);
  }
  return [
    ...[...duplicates.entries()].filter(([, ids]) => ids.length > 1).map(([effect, ids]) => ({ code: "duplicate-effect", critical: true, effect, event_ids: ids })),
    ...observed
    .filter((event) => event.type === "effect_observed" && STRONG.has(event.authority))
    .flatMap((event) => {
      const issues = [];
      const verb = event.data?.verb;
      const index = event.data?.index;
      if (planned.get(index) !== verb) issues.push({ code: "unplanned-effect", critical: true, event_id: event.event_id, index, verb });
      if (decision.restrict?.includes(verb)) issues.push({ code: "restricted-effect", critical: true, event_id: event.event_id, index, verb });
      return issues;
    }),
    ...claimed.flatMap((event) => {
      const issues = [];
      const verb = event.data?.verb;
      const index = event.data?.index;
      if (planned.get(index) !== verb) issues.push({ code: "claimed-unplanned-effect", critical: false, event_id: event.event_id, index, verb });
      if (decision.restrict?.includes(verb)) issues.push({ code: "claimed-restricted-effect", critical: true, event_id: event.event_id, index, verb });
      return issues;
    })
  ];
}

function judgeExpectation(expectation, events) {
  if (expectation.kind === "decision") {
    const evidence = events.filter((event) => event.type === "decision_emitted");
    const exact = evidence.find((event) => {
      const emitted = event.data?.decision;
      if (event.authority !== "runtime_observed" || !emitted || emitted.decision_id !== event.decision_id) return false;
      return sha256({ ...emitted, decision_id: undefined }) === emitted.decision_id;
    });
    if (exact) return { ...expectation, verdict: "satisfied", critical: false, evidence: [exact.event_id], reason: null };
    return { ...expectation, verdict: evidence.length ? "violated" : "unproven", critical: evidence.length > 0, evidence: evidence.map((event) => event.event_id), reason: evidence.length ? "invalid-decision-emission" : "missing-decision-emission" };
  }
  if (expectation.kind === "effect") {
    const evidence = events.filter((event) => ["effect_observed", "effect_claimed"].includes(event.type) && event.data?.index === expectation.index && event.data?.verb === expectation.verb);
    const strong = evidence.find((event) => STRONG.has(event.authority));
    if (strong) {
      const observedOrder = events.filter((event) => event.type === "effect_observed" && STRONG.has(event.authority)).map((event) => event.data.index);
      const sorted = [...observedOrder].sort((a, b) => a - b);
      if (observedOrder.join(",") !== sorted.join(",")) return { ...expectation, verdict: "violated", critical: true, evidence: [strong.event_id], reason: "effect-order" };
      return { ...expectation, verdict: "satisfied", critical: false, evidence: [strong.event_id], reason: null };
    }
    return { ...expectation, verdict: "unproven", critical: false, evidence: evidence.map((event) => event.event_id), reason: evidence.length ? "agent-claim-only" : "missing-evidence" };
  }
  const evidence = events.filter((event) => ["proof_recorded", "artifact_verified", "receipt_recorded", "effect_observed"].includes(event.type) && matchesProof(expectation.proof, event));
  const strong = evidence.find((event) => STRONG.has(event.authority));
  return strong
    ? { ...expectation, verdict: "satisfied", critical: false, evidence: [strong.event_id], reason: null }
    : { ...expectation, verdict: "unproven", critical: false, evidence: evidence.map((event) => event.event_id), reason: evidence.length ? "weak-authority" : "missing-evidence" };
}

function matchesProof(proof, event) {
  const data = event.data;
  if (!data) return false;
  if (event.type === "artifact_verified") {
    return event.authority === "artifact_verified" && data.reference === proof.reference && (!proof.path || data.artifact?.expected_path?.replace(/\\/g, "/").endsWith(`/${proof.path.replace(/\\/g, "/")}`));
  }
  if (proof.kind === "effect") return data.kind === "effect" && data.index === proof.index && data.verb === proof.verb;
  if (data.kind !== proof.kind) return false;
  return proof.reference === null || proof.reference === undefined || data.reference === proof.reference;
}

function report(decision, aggregate, verdicts, issues) {
  const value = {
    schema: "urn:nanomia:skill-contract:alignment:1",
    alignment_id: null,
    decision_id: decision.decision_id,
    spec_fingerprint: decision.spec.fingerprint,
    snapshot_fingerprint: decision.snapshot.fingerprint,
    aggregate,
    expectations: verdicts,
    issues
  };
  value.alignment_id = sha256({ ...value, alignment_id: undefined });
  return value;
}
