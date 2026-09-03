# Skill Rails project instructions

These instructions apply to every change in this repository. The user's current explicit direction has higher priority than these defaults.

## Product intent

Skill Rails helps an AI create and maintain one standalone skill without keeping all behavior in growing prose.

- Record user intent and keep each requirement traceable to its implementation and check.
- Mechanize every rule that can be executed or verified reliably. Keep genuine interpretation and judgment in concise prose.
- Choose P0, P1, or P2 per skill, never for an entire plugin or repository. Use the smallest profile that still mechanizes the real repeatable behavior.
- For P2, keep `spec.mjs` as the only behavior source. The runtime calculates the current Decision; it does not perform the domain work or enforce host tool permissions.
- Missing evidence is `unproven`, not success. Structural validity is not proof of fresh-agent behavior.
- When one skill outgrows the profile it selected, decompose or rescope that skill instead of growing the core grammar to carry it.
- Effect credit on the public lane cannot exceed the authority actually observed for that effect.
- The core authoring model is platform-independent. Codex and Claude Code are the adapters currently implemented and tested, not the permanent product boundary.

## Change discipline

- Understand the whole authoring, generated-package, and using-agent flow before changing one local symptom.
- Prefer a coherent correction at the owning abstraction over accumulating special cases or parallel sources of truth.
- When a shipped operational contract changes, update its canonical creator code, routed reference, generated projection, and proportional regression evidence in the same coherent change. Do not land a reference-only or generated-only half-update.
- Do not silently weaken the P2 version-5 compatibility contract or reduce a rule that can be mechanized back into prose. A better design is allowed, but record what changed, why it is safer or clearer, and which evidence supports it in `docs/implementation-verification_ko.md`.
- Preserve existing user changes and keep all writes inside this repository unless the user explicitly expands the scope.
- Never hand-edit generated files governed by `.generated.json`; change the canonical source and rebuild.
- Do not commit, push, publish, or deploy unless the user explicitly requests that action. Keep unrelated milestones in separate commits when the user asks for a checkpoint.
- If an implementation choice changes a product boundary, behavior contract, or irreversible action, stop and obtain the user's direction.

## Verification

- Run checks proportional to the change while iterating.
- For documentation, validate Markdown structure, local links, commands, language parity, and claim accuracy against code and tests.
- Before a release claim, run `npm run verify` and any required fresh-agent or installation tests. Report the exact verified scope and remaining unknowns.

## Canonical references

- `skills/skill-rails/SKILL.md` — skill-user entry procedure and the sole conditional router for creation, maintenance, P2, migration, and evaluation references
- `docs/maintenance-status_ko.md` — current milestone, exact continuation point, and next-session entry; read first when resuming repository work
- `docs/skill-rails_ko.md` — current product purpose, architecture, and stable design boundaries; read when changing product behavior or owning abstractions
- `docs/implementation-verification_ko.md` — exact implementation scope, support evidence, unproven boundaries, and P2 compatibility ledger; read for verification claims or P2 contract changes
- `docs/authoring-lessons_ko.md` — detailed experience for high-cost core choices, nonconvergence recovery, and successor comprehension
- `docs/upgrade-from-v0.1.9_ko.md` — what a consumer built by v0.1.9 must check and rebuild to move to the current version; read when planning or performing that upgrade

Do not read all project documents by default. For repository resumption or current-state work, start from the maintenance status and load another maintainer document only when the task requires its authority. For skill-user work, follow `skills/skill-rails/SKILL.md` without preloading maintainer docs.

## Document ownership and update cadence

- Maintainer documents preserve purpose, rationale, stable boundaries, ownership, and evidence or unknowns that code alone cannot explain. For exact behavior and change scope, inspect the current owning code, schema, and targeted tests; do not copy line-by-line implementation or command listings into prose unless that prose is itself the shipped contract.
- `skills/skill-rails/SKILL.md` and the references it conditionally routes are the shipped operational path for creating, migrating, maintaining, and evaluating skills. Keep commands and executable contracts there, with one canonical owner per rule.
- `docs/maintenance-status_ko.md` is a replaceable snapshot. Update it at a coherent milestone or handoff, not after every edit.
- `docs/skill-rails_ko.md` changes only when the stable product purpose, architecture, or owning boundary changes.
- `docs/implementation-verification_ko.md` changes when material implementation, support evidence, unproven scope, or P2 compatibility changes. Replace superseded current claims instead of appending a daily log, but never discard a unique receipt merely because a newer run exists. A receipt is superseded only when the newer evidence covers the same claim, bytes, host, scope, and authority; otherwise retain it or link its exact durable artifact or Git commit.
- `docs/authoring-lessons_ko.md` preserves the causal history of major product turns and reusable lessons about creating and maintaining skills. Keep V5/V6-scale failures and the reason a later approach replaced them understandable to a cold successor; put routine chronology in Git or the orchestration record, and keep provider-specific operating details in the current handoff unless they generalize.
- `README.md` and `README.ko.md` are human-facing public explanations. They are not maintainer entry points, design authorities, or evidence owners; a maintainer must follow the canonical routes above even when README wording later changes independently.
- Do not create a second documentation index. This file owns maintainer routing; `skills/skill-rails/SKILL.md` owns skill-user routing. If documents disagree, correct the owning document rather than explaining the conflict elsewhere.
- A successor starts with this file and the maintenance snapshot, then opens the first document that owns its task. It may open further owner documents when the task crosses a boundary; do not turn progressive reading into a one-document prohibition. Before transferring coordinator authority, test that the successor can reconstruct the product's origin and major failure causes, locate the current evidence owner, and apply the rules to an unfamiliar counterexample.
