---
name: natural-language-pilot-direct-next
description: Turn the natural-language pilot brief into one bounded plan card without inventing decisions or replacing an existing plan. Use only for the natural-language pilot fixture contract.
---

# Direct the pilot plan

Work only in the given project root. The sole input is `pilot/brief.md`, and the sole output is `pilot/plan.md`.

1. Check whether `pilot/plan.md` exists before reading or writing the output. If it exists, stop without changing it.
2. Read `pilot/brief.md`. If it is missing or cannot be read, stop without creating the plan.
3. Prepare one plan containing exactly one card with the id `bookmark-storage`. In that card, preserve all of these brief commitments:
   - one user
   - store a bookmark by stable id
   - retrieve the same HTTPS URL for that stable id
   - return no value for an unknown id
   - the exact phrase `save once, retrieve exactly`
   - only HTTPS URLs are inside the acceptance boundary
4. In the same card, state that storage location, retention period, and import support are each `unknown`.
5. Do not add another card, a dependency graph, workflow state, another stage, users, features, commands, storage choices, retention choices, import behavior, or any other scope that the brief does not state.
6. Create `pilot/plan.md` only with an operation that fails when the path already exists. If exclusive creation is unavailable, or if another writer creates the file first, stop without writing or replacing it.

Done means one previously absent plan was exclusively created, it contains exactly the one `bookmark-storage` card with every stated behavior and phrase intact, and every named undecided detail remains unknown. Report a pre-existing plan, missing input, or exclusive-create conflict as no-write rather than trying to repair or merge the file.
