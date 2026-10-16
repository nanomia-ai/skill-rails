---
name: natural-language-pilot-work-next
description: Implement the natural-language pilot bookmark-storage card and record passing progress without replacing current work or resolving production unknowns. Use only for the natural-language pilot fixture contract.
---

# Work the bookmark-storage card

Work only in the given project root. The card id is exactly `bookmark-storage`. The possible outputs are `src/bookmark-storage.mjs` and `pilot/progress.md`.

1. Check whether `pilot/progress.md` exists before reading or writing anything else. If it exists, stop with no writes; do not validate, repair, replace, or merge it.
2. Read all four inputs: `pilot/brief.md`, `pilot/plan.md`, `package.json`, and `test/run.mjs`. If any input is missing or unreadable, stop without creating the source or progress. Treat the brief and plan as the meaning boundary and the package and test as the exact local execution contract.
3. Check whether `src/bookmark-storage.mjs` exists.
   - If it is absent, implement only the `bookmark-storage` card and create the file with an exclusive operation that fails if the path already exists. The module must be dependency-free and export `createBookmarkStorage`. Each created storage instance must use an in-process `Map`; `add(stableId, url)` stores an HTTPS URL by stable id, `get(stableId)` returns that same URL, and `get` returns `null` for an unknown id. State explicitly in the source that this is a reversible, non-production semantic implementation. Do not choose a production storage location, retention period, or import behavior.
   - If the source already exists, or another writer wins the exclusive creation, never edit or replace it. Treat its current bytes only as interrupted work for this card; do not infer that the card is complete.
4. Run exactly `npm test -- bookmark-storage`. Do not run an install, another test command, a retry command, or a substitute command.
5. If the command does not exit `0`, leave `pilot/progress.md` absent. Report any source bytes left in the project as an ordinary host effect, not as Skill Rails-authoritative progress.
6. Only after exit `0`, reread `src/bookmark-storage.mjs`. Then create `pilot/progress.md` with an exclusive operation that fails if the path already exists. The progress must state all of the following:
   - card id: exactly `bookmark-storage`
   - status: exactly `implemented`
   - source: `src/bookmark-storage.mjs`
   - test: `test/run.mjs`
   - passing command evidence: `npm test -- bookmark-storage` exited `0`
   - boundary: the source uses a dependency-free in-process `Map` as a reversible, non-production semantic implementation
   - production storage location: `unknown`
   - retention period: `unknown`
   - import support: `unknown`
7. If exclusive progress creation is unavailable or loses a race, stop without changing the existing progress. After successful creation, reread `pilot/progress.md` before claiming the recorded effect.

Never edit `pilot/brief.md`, `pilot/plan.md`, `package.json`, or `test/run.mjs`. Do not create another card, state machine, observer, packet, prepare step, fallback, renderer, schema, protocol, harness, rollback, auto-merge, or transaction.

Done means the exact test command exited `0`, the current source was reread, progress was exclusively created with every required fact, and the progress bytes were reread. A pre-existing progress file is a no-write stop; a failed test leaves progress absent and does not make source bytes Skill Rails-authoritative.
