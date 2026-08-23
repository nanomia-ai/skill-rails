# Evaluation and evidence

## Contents

- Separate targets
- Clean testing
- Evidence authority
- Release interpretation

## Separate targets

Evaluate creator usability, generated-skill usability, and task-output quality separately. Do not let one agent/context create, consume, and grade the same artifact.

## Clean testing

Use fresh contexts and provide only the raw skill, task, and input artifact. Hide intended fixes, prior failures, and expected answers. Compare with no-skill or old-skill baselines, include trigger near misses and held-out states, and inspect transcripts, tool order, evidence, and outputs.

## Evidence authority

- `runtime_observed`: directly calculated by the runtime.
- `harness_observed`: recorded by a trusted adapter or hook.
- `artifact_verified`: rechecked artifact and fingerprint.
- `agent_claimed`: model self-report; insufficient for critical proof.
- `human_confirmed`: only when a trusted channel records the human action and scope.

Alignment verdicts are `satisfied`, `violated`, `unproven`, or `not_applicable`. Aggregate results are `aligned`, `partial`, `unproven`, `misaligned`, or `stale`.

## Release interpretation

Report deterministic, probabilistic, evidence-bounded, and unproven results separately. Structural generation is not behavior verification. A successful command without required evidence remains unproven.
