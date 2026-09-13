---
name: natural-language-pilot-resume-next
description: Recover the current natural-language bookmark pilot position and next action from its brief, plan, progress, and verification artifacts without creating durable state. Use only for the natural-language pilot fixture contract.
---

# Resume the bookmark-storage pilot

Work only in the given project root. This target is read-only: do not create, edit, repair, merge, or delete project files.

Read `pilot/brief.md`, `pilot/plan.md`, `pilot/progress.md`, and `pilot/verification.md`. Treat missing files as absent evidence, not as empty or completed work. Use the current artifact contents as the only state source; do not inspect conversation history, source code, tests, generated runtime, or a global workflow state.

Report four short sections:

1. `Current position`: the latest stage supported by the artifacts, without treating file presence alone as completion.
2. `Observed basis`: each artifact path and the specific fact it supports.
3. `Next action`: exactly one of Product, Direct, Work, Verify, or maintain. Choose the earliest stage whose required artifact or evidence is absent or not complete; choose maintain only when the exact `bookmark-storage` card has implemented progress and a verification record with verdict `pass`.
4. `Unknowns`: preserve every unresolved product unknown in the artifacts. For this pilot, production storage location, retention period, and import support remain unknown unless a current artifact explicitly resolves them.

Do not infer that an implementation is production-ready from passing verification. Do not invent a stale-replacement rule, reservation, checkpoint, state file, database, or recovery protocol. Your report is AI interpretation of current artifacts and has no file-effect authority.

Done means the response identifies the supported current position, cites all four artifact paths, gives exactly one next action, preserves unresolved unknowns, and makes no project write.
