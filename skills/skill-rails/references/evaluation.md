# Evaluation and evidence

## Contents

- Separate targets
- Clean testing
- Fresh downstream testing
- Evidence authority
- Context surface
- Release interpretation

## Separate targets

Evaluate creator usability, generated-skill usability, and task-output quality separately. Do not let one agent/context create, consume, and grade the same artifact.

## Clean testing

Use fresh contexts and provide only the raw skill, task, and input artifact. Hide intended fixes, prior failures, and expected answers. Compare with no-skill or old-skill baselines, include trigger near misses and held-out states, and inspect transcripts, tool order, evidence, and outputs.

P2 scenario/simulate fixtures spell unobserved values as the literal string `"UNKNOWN"` or by omission; every observation lane normalizes that raw spelling to the reserved sentinel before predicates run.
For guard coverage, a `cover` entry `guard:<id>` is credited only when the guard predicate matched; a guard blocked on an unresolved required read is credited as `guard-pending:<id>`, and guard coverage accepts either token.

## Fresh downstream testing

When a generated skill produces a durable output intended for later AI consumption, test that handoff separately from the skill-consumer run. Give a fresh context only the output and the durable dependencies that the output explicitly identifies. Do not also provide the original task, generated skill, producer transcript, or expected interpretation unless the output declares one of them as a required dependency.

This limits the handoff context supplied for interpretation, not the files or tools the interpreted work legitimately requires.

Ask the fresh consumer to interpret the output or continue the intended work. Check that it recovers the information needed for correct use, which may include the applicable purpose, terms, input identity and scope, constraints, evidence or uncertainty, result or status, and a durable condition -> action next step that remains correct after either side of the condition changes. Do not require irrelevant fields or repeated background.

A valid template, a declared artifact reader, or a successful producing run does not prove downstream understanding. Missing handoff context remains `unproven`; do not expect the consumer to scan the skill package or unrelated project files to reconstruct it.

## Evidence authority

- `runtime_observed`: directly calculated by the runtime.
- `harness_observed`: recorded by a trusted adapter or hook.
- `artifact_verified`: rechecked artifact and fingerprint.
- `agent_claimed`: model self-report; insufficient for critical proof.
- `human_confirmed`: only when a trusted channel records the human action and scope.

Automated alignment treats `runtime_observed`, `harness_observed`, and `artifact_verified` as strong; `agent_claimed` and `human_confirmed` are weak and never satisfy an expectation by themselves, so evidence carrying only those authorities leaves it `unproven`.

Grade what an event actually proves, not that it exists:

- `runtime_observed` about the runtime's own repeatability is a structural check; it must not move an aggregate from `unproven` to `partial`.
- `artifact_verified` proves a declared artifact's canonical path and bytes at that fingerprint, not that the effect behind it happened.
- An `effect_claimed` event recorded by the model carries `agent_claimed` authority; that is weak evidence and leaves the expectation `unproven` with reason `agent-claim-only`.
- Authority decides effect credit, not event type: the effect expectation matches events of type `effect_observed` or `effect_claimed` for that index and verb, and is satisfied by the first one whose authority is strong. A trusted adapter recording `effect_claimed` at strong authority therefore counts, while `effect_observed` at weak authority does not.

Alignment verdicts are `satisfied`, `violated`, or `unproven`. Aggregate results are `aligned`, `partial`, `unproven`, `misaligned`, or `stale`.

## Context surface

For P0/P1, evaluation reports entry bytes, routing-index bytes, their fixed sum, on-demand topic count and bytes, the largest topic, and total stored guidance. These are deterministic byte measurements, not token estimates or behavior evidence. Do not infer that a model matched the right condition or avoided unrelated files from a smaller fixed surface; verify that with a fresh consumer transcript.

## Release interpretation

Report deterministic, probabilistic, evidence-bounded, and unproven results separately. Structural generation is not behavior verification. A successful command without required evidence remains unproven.
