---
name: editorial-review-next
description: Review the fixed museum-label fixture and safely record one editorial decision. Use only for the M7 non-Devflow generalization check.
---

# Review one museum label

Run `node <target-root>/scripts/run.mjs prepare --project <project-root>`.

- On `PREPARED`, read the returned packet and only the files it names.
- Fill the returned answer according to its exact answer contract without adding fields.
- Run the exact returned record command once. Treat only its reread-confirmed result as a file effect.
- On `PREPARE_FAILED`, open `references/fallback.md`, stop without writing, and report the result as unproven.
- On any integrity, stale, conflict, lock, renderer, or apply error, perform only the returned recovery action.

This target exercises M7 delivery and deterministic runtime boundaries. A machine run does not prove fresh-AI behavior or editorial quality.
