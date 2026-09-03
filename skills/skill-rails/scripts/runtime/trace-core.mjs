import { resolve } from "node:path";
import { hashFile } from "./hash.mjs";
import { fail } from "./diagnostics.mjs";
import { appendTraceEvent } from "./trace-store.mjs";
import { canonicalPath, isInside } from "./path-policy.mjs";

export { appendTraceEvent, createTraceEvent, readTrace, traceIntegrityIssues } from "./trace-store.mjs";

export async function recordEvidence({ skillRoot, traceDir, runId, decision, type, authority = "agent_claimed", data = {}, artifactPath = null, expectedArtifactPath = null, projectRoot = null }) {
  if (!skillRoot) fail("SR_EVIDENCE_SKILL", "Evidence recording requires the skill root so external-state isolation can be verified.");
  await assertExternalStateDir(skillRoot, traceDir, projectRoot);
  const payload = { ...data };
  let effectiveAuthority = authority;
  if (effectiveAuthority !== "agent_claimed") fail("SR_EVIDENCE_AUTHORITY", "Agent-facing evidence may not assign a trusted authority.");
  if (artifactPath) {
    if (!expectedArtifactPath) fail("SR_EVIDENCE_EXPECTED_PATH", "Artifact verification requires a trusted expected path.");
    const [actual, expected] = await Promise.all([canonicalPath(artifactPath), canonicalPath(expectedArtifactPath)]);
    if (actual !== expected) fail("SR_EVIDENCE_PATH", "Artifact evidence path does not match the declared artifact path.", { pointer: artifactPath, details: { expected } });
    try {
      payload.artifact = { path: actual, expected_path: expected, hash: await hashFile(actual) };
      effectiveAuthority = "artifact_verified";
    } catch (error) { fail("SR_EVIDENCE_ARTIFACT", `Cannot verify artifact: ${artifactPath}`, { cause: error }); }
  }
  if (effectiveAuthority === "artifact_verified" && !artifactPath) fail("SR_EVIDENCE_ARTIFACT", "artifact_verified authority requires a verified artifact path.");
  return appendTraceEvent(traceDir, {
    run_id: runId,
    type,
    authority: effectiveAuthority,
    decision_id: decision.decision_id,
    spec_fingerprint: decision.spec.fingerprint,
    snapshot_fingerprint: decision.snapshot.fingerprint,
    data: payload
  });
}

export async function recordHarnessEvidence({ skillRoot, traceDir, runId, decision, type, data = {} }) {
  await assertExternalStateDir(skillRoot, traceDir);
  return appendTraceEvent(traceDir, {
    run_id: runId, type, authority: "harness_observed", decision_id: decision.decision_id,
    spec_fingerprint: decision.spec.fingerprint, snapshot_fingerprint: decision.snapshot.fingerprint, data
  });
}

export async function assertExternalStateDir(skillRoot, stateDir, projectRoot = null) {
  if (isInside(resolve(skillRoot), resolve(stateDir))) fail("SR_STATE_INSIDE_SKILL", "Runtime state must be outside the installed skill package.", { pointer: stateDir });
  const [canonicalSkill, canonicalState] = await Promise.all([canonicalPath(skillRoot), canonicalPath(stateDir)]);
  if (isInside(canonicalSkill, canonicalState)) fail("SR_STATE_INSIDE_SKILL", "Runtime state must be outside the installed skill package, including symlink and junction targets.", { pointer: stateDir });
  // The observed project is the other place runtime state must not land. Writing a trace inside it
  // leaves untracked files that the project's own tooling then sees as its own state, which is the
  // failure a consumer reaches by following "outside the installed skill" literally.
  if (!projectRoot) return;
  if (isInside(resolve(projectRoot), resolve(stateDir))) fail("SR_STATE_INSIDE_PROJECT", "Runtime state must be outside the observed project.", { pointer: stateDir });
  const canonicalProject = await canonicalPath(projectRoot);
  if (isInside(canonicalProject, canonicalState)) fail("SR_STATE_INSIDE_PROJECT", "Runtime state must be outside the observed project, including symlink and junction targets.", { pointer: stateDir });
}
