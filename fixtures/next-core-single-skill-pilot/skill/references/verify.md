# Verify stage

Use this reference only when the current Decision selects channel, acquire, or evidence.

## Purpose

Credit a verifier result only when its declared columns match freshly collected facts for the current task and selected bytes.

## Shared rules

- Keep a finding or missing proof outside completion under the [Status notation judgment core](canon.md#status-notation-judgment-core).
- Apply the [Failure ladder](canon.md#failure-ladder) only to a dispatched attempt whose guidance was insufficient, not to a verification finding or correction cycle.
- Use PROVEN, UNPROVEN, and NON-PASS only as defined by the [Evidence credit notation](canon.md#evidence-credit-notation).

## Declared-column rule

The verifier returns the exact task, snapshot, selection locator, selected-byte SHA-256, continuation, verdict, and recorded currentness it observed. In particular, selection must be the locator the verifier read and selection-hash must be the SHA-256 of those exact selected bytes; neither field may be replaced by a summary or remembered value.

Credit a pass only when task, snapshot, selection, selection-hash, continuation, and recorded-json.currentness all match the freshly collected task, snapshot, selection locator, selected-byte hash, continuation, and currentness facts, and the declared verdict is pass. A stale result, any identity mismatch, or a finding remains NON-PASS.

The evidence stage's reentry: rejudge means agent reentry: after recording a result, reinvoke the same run so collectors gather current facts and the table is judged again. It is not runtime-side reobservation, dispatch, or a separate binding mechanism.

## Decision use

Follow the current Decision's `stage_artifacts` and ordered effects exactly. `stage_artifacts` is the complete static project-path set declared for this selected stage; resolve each path from `<project>`. The runtime projects them but does not acquire a channel, dispatch a verifier, or write the result. A host or agent claim is not trusted observation merely because it follows the plan.

- Resolve Decision paths from <project>; if any required path is unavailable or escapes the project after canonical path resolution, stop UNPROVEN.
- For RUN acquire-channel, read its declared input and accept exactly one nonempty argv array or approver string.
- For DISPATCH dispatch-verifier, use the AI host tools: argv[0] is the executable; invoke it with argv[1..] without a shell, or ask the named approver. An argv channel whose argv[0] does not itself name an executable is incomplete; stop UNPROVEN before any effect claim.
- For WRITE record-result, append exactly one Decision-format line to the matching Decision proof path without rewriting existing content.
- Record each effect index, verb, and exact executed argv array (or named approver) as the used channel in public data; record artifact_verified against the matching Decision proof, align, and reinvoke the same run.

For every current Decision proof_required descriptor, pass its reference unchanged as record --data.reference, and pass the file named by its path as --artifact under the same --project. For the pilot result proof, the exact mapping is:

    node <skill-root>/scripts/skill-rails/run.mjs record --decision <stage-result.json> --type artifact_verified --data {reference:verifierResult} --artifact <project>/<proof.path> --project <project> --json

## Evidence interpretation

An unavailable channel or inaccessible fact remains UNPROVEN. A finding, stale result, or declared-column mismatch remains NON-PASS. A matching pass is limited to the freshly bound task, snapshot, selection locator and bytes, continuation, currentness, and available alignment evidence.

If alignment lacks strong effect evidence, report that missing evidence instead of reconstructing success from the Decision or trace prose.
