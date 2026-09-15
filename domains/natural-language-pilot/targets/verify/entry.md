---
name: natural-language-pilot-verify-next
description: Verify the fixed bookmark-storage pilot and safely record pass, fail, or unproven while preserving existing report bytes. Use only for the natural-language pilot fixture contract.
---

# Verify the bookmark-storage pilot

Set `<target-root>` to the directory containing this `SKILL.md`, then run `node "<target-root>/scripts/run.mjs" initialize --project <project-root>` first.

- On `RECORD_INITIALIZED`, read each returned `inputs[].absolutePath` whose `state` is `present`; treat `absent` as absent evidence without reading that path, then read the returned `domainConfig`. Do not inspect runtime source or look for a prepared packet.
- Run the exact verification command declared by `domainConfig.verificationCommand` from its declared project-relative `cwd`.
- Decide whether the evidence justifies `pass`, `fail`, or `unproven` for the declared `cardId`: pass requires the command to succeed and report the expected test identity; a command execution failure, an unexecuted command, an unknown card identity, or insufficient evidence is unproven; use fail only for direct evidence that the acceptance behavior does not hold.
- Fill the returned `answer` JSON without adding fields. Preserve unknown reasons and do not claim file or host effects beyond the authority actually observed, then run the returned exact `recordCommand`.
- If `recordCommand` exits without one valid JSON result, retry that exact command once; a write that already succeeded returns `APPLIED_ALREADY`. Never reconstruct or edit the output manually.
- On initialize, integrity, answer, stale, conflict, lock, renderer, or apply errors, perform only the returned `nextAction`. Never repair generated files or merge report bytes by hand.

Done means record returns an observed `APPLIED`, idempotent `APPLIED_ALREADY`, or a fail-closed recovery result without overstating semantic or effect authority. Build delivery, AI behavior, semantic correctness, and observed file effect are separate evidence lanes; anything not observed in its proper lane remains `unproven`.
