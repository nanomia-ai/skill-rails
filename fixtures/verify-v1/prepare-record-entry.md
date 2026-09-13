---
name: natural-language-pilot-verify-next
description: Verify the fixed bookmark-storage pilot and safely record pass, fail, or unproven while preserving existing report bytes. Use only for the natural-language pilot fixture contract.
---

# Verify the bookmark-storage pilot

Run `node <target-root>/scripts/run.mjs prepare --project <project-root>` first.

- On `PREPARED`, open only the returned `packet` plus the files it explicitly lists.
- Fill the returned `answer` JSON without adding fields, then run its exact `recordCommand`.
- If `recordCommand` exits without one valid JSON result, retry that exact command once; a write that already succeeded returns `APPLIED_ALREADY`. Never reconstruct or edit the output manually.
- Open `references/fallback.md` only when prepare returns `PREPARE_FAILED`; use only that fallback and the project files it names, without inspecting or invoking other target runtime files. Record the run as fallback, not treatment success.
- On integrity, stale, conflict, lock, renderer, or apply errors, perform only the returned `nextAction`. Never repair generated files or merge report bytes by hand.

Build delivery, AI behavior, semantic correctness, and observed file effect are separate evidence lanes. Anything not observed in its proper lane remains `unproven`.
