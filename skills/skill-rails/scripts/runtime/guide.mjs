import { KERNEL_VERSION } from "./constants.mjs";
import { stableStringify } from "./hash.mjs";

export function renderGuide(decision, options = {}) {
  const lines = [
    `Skill Rails kernel/${KERNEL_VERSION}`,
    `schema / spec / snapshot: ${decision.schema} | ${decision.spec.id}@${decision.spec.fingerprint} | ${decision.snapshot.fingerprint}`,
    `decision / enter-hash: ${decision.decision_id} | ${options.enterHash ?? "none"}`,
    `status / stop reason: ${decision.status} | ${stopReason(decision)}`,
    `guard / restrict / bypass: ${decision.guard?.id ?? "none"} | ${list(decision.restrict)} | ${decision.bypassed.length ? stableStringify(decision.bypassed) : "none"}`,
    `stage / row / facts: ${decision.stage ?? "none"} | ${decision.row ?? "none"} | ${decision.facts.length ? stableStringify(decision.facts) : "none"}`,
    `judged / decided: ${object(decision.judged)} | ${object(decision.decided)}`,
    `needs / reads / record / reentry: ${decision.needs.length ? stableStringify(decision.needs) : "none"} | ${list(decision.reads)} | ${decision.record ? stableStringify(decision.record) : "none"} | ${decision.reinvoke ?? "none"}`,
    `ordered effects: ${renderEffects(decision.effects)}`,
    `proof required: ${decision.proof_required.length ? stableStringify(decision.proof_required) : "none"}`,
    `stage artifacts: ${decision.stage_artifacts.length ? stableStringify(decision.stage_artifacts) : "none"}`,
    `format / template: ${decision.format?.example ?? "none"} | ${decision.template ?? "none"}`
  ];
  if (decision.template_text) lines.push(`template content:\n${decision.template_text.trimEnd()}\n---`);
  if (decision.body) lines.push(`body section: ${decision.body.ref} ${decision.body.hash}\n${decision.body.markdown}\n---`);
  lines.push(`reinvoke condition: ${decision.reinvoke ?? "none"}`);
  lines.push("Already verified done stages may be skipped. ASK, WAIT, and approval receipts may not be skipped. Re-run enter if this context has not seen the enter-hash.");
  return lines.join("\n");
}

function renderEffects(effects) {
  if (!effects?.length) return "none";
  return effects.map((effect) => Array.isArray(effect) ? `${effect[0]}(${Object.entries(effect[1] ?? {}).map(([key, value]) => `${key}=${typeof value === "string" ? value : stableStringify(value)}`).join(",")})` : effect).join(" -> ");
}

function stopReason(decision) {
  if (decision.guard?.reason) return decision.guard.reason;
  if (decision.needs.length) return `needs ${decision.needs.map((item) => item.field).join(",")}`;
  if (["ASK", "WAIT", "ROUTE", "BLOCK", "DONE"].includes(decision.status)) return decision.row ?? decision.guard?.id ?? decision.stage ?? decision.status.toLowerCase();
  return "none";
}

function list(value) { return value?.length ? value.join(",") : "none"; }
function object(value) { return value && Object.keys(value).length ? stableStringify(value) : "none"; }
