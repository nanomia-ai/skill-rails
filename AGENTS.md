# Skill Rails Next project instructions

These instructions apply to every change in this repository. The user's current explicit direction has higher priority.

## Product boundary

This repository is rebuilding Skill Rails from a clean greenfield source. The product reduces the total work an AI must read, reinterpret, copy, format, and recover while leaving genuine meaning judgments with the AI or user.

- Treat `docs/plan/initial-ai-first-skill-system-concept_ko.md` and `docs/plan/implementation-ready-development-plan_ko.md` as frozen user-approved sources. Never edit, move, rename, or replace them.
- Record implementation discoveries and plan deviations in `docs/plan/implementation-evolution-plan_ko.md`; do not rewrite a frozen plan to match later code.
- Never use the archived Skill Rails or Devflow implementation as an architecture baseline, compatibility layer, import, runtime fallback, fixture answer key, or generated source. It may support only a concrete later counterexample or recovery audit.
- Keep one canonical owner for each purpose, observation, judgment, deterministic calculation, renderer, state coordinate, effect, and evidence claim.
- Mechanize only rules that reliably remove repeated prose, calculation, formatting, currentness, or recovery cost. Do not add machinery merely because it is expressible.
- Structural checks prove structure. They do not prove fresh-AI behavior or real host effects. Missing evidence is `unproven`.
- Generated packages are standalone. They must not depend at runtime on this repository, a sibling skill, a global Skill Rails installation, or the legacy capsule.
- Stop for user direction if a choice changes the product purpose, allowed cost, authority boundary, publishing/cutover identity, or an irreversible action.

## Maintainer entry

1. Read `docs/maintenance-status_ko.md` to recover the current milestone and exact next action.
2. Read the first document that owns the task:
   - stable product and architecture boundary: `docs/skill-rails_ko.md`
   - implementation scope, receipts, and `unproven` claims: `docs/implementation-verification_ko.md`
   - implementation changes from the frozen plan: `docs/plan/implementation-evolution-plan_ko.md`
   - frozen requirement or decision trace: the two files in `docs/plan/`
3. For judgment depth, start at §0.1 of `docs/guide/universal-ai-skill-inquiry-framework.md` and read only the sections that can change the current decision.
4. Inspect the current canonical source and its direct consumer before editing. If `.codegraph/` exists, use CodeGraph before text search to locate or understand code.

Do not preload every document. Open another owner when the task crosses its boundary.

After a handoff, resume, or context compaction/reconstruction, reopen this file from disk and repeat Maintainer entry steps 1–3 before acting. A coordinator continuing through that boundary must pass the refreshed current milestone, one pending decision, evidence boundary, and exact next action to any active worker; inherited conversation context is not a substitute.

## Change and verification discipline

- Preserve user changes. README files are not implementation authorities and must not be updated unless the user explicitly asks.
- Keep writes inside this repository except for an explicitly authorized standard installation or external behavior test.
- Never hand-edit generated files. Change their canonical source and rebuild.
- Use final source/package paths from the frozen plan; do not create an incubator or a second active implementation.
- Keep code-near comments to one non-obvious why, invariant, or risk plus the most stable test/contract pointer. Do not duplicate graph relations or exact behavior in prose.
- Run checks proportional to the change. Record meaning, delivery, fresh behavior, and effect evidence separately.
- Before an evaluation gate has changed a product decision, a second revision or additional evaluator-only protocol, schema, harness, matrix, agent path, or verification workflow serving that same decision is a proliferation signal, regardless of its filename or label. Stop that expansion, record the drift in `docs/plan/implementation-evolution-plan_ko.md`, and obtain user direction before continuing; leaving the claim `unproven` is preferable to building a validator for the validator.
- Do not commit, publish, push, install globally, or deploy unless the user has explicitly authorized that action. Published identity and `latest` cutover always require a separate decision.
- Before removing or overwriting material, resolve exact paths, verify recovery evidence, and respect the approval boundary recorded in the frozen plan and Evolution document.

## Legacy capsule

`legacy/archive/v0.4.3/` is a non-executable recovery capsule. Active source, tests, package discovery, imports, build inputs, and runtime code must never traverse it. Extract it only into a new temporary root and verify its inventory; restoring over the live tree requires separate user approval.
