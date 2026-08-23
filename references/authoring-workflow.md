# Authoring workflow

## Contents

- Intent brief
- Profile selection
- Creation order
- Maintenance
- Completion boundary

## Intent brief

Start from `templates/intent-brief.json`; its keys are the input contract. Record the problem, positive use cases, near-miss triggers, inputs, outputs, irreversible boundaries, state-dependent behavior, exact formats, external dependencies, evidence of completion, judgment points, and deterministic helpers. Ask only when an answer changes a product boundary or an irreversible action.

## Profile selection

- P0: judgment and concise guidance only. Do not create `spec.mjs`.
- P1: exact formats or deterministic helpers, scripts, templates, or validators are useful, but no state machine is required.
- P2: use when state-dependent branches, guards, ordered effects, exact formats, or evidence-gated completion repeat.

Do not choose P2 merely because the source is long. The generator records the selected profile, signals, and reasons in `.skill-rails/profile-decision.json`; `.skill-rails/intent.json` remains the canonical input.

## Creation order

1. Write the intent brief and evaluation cases.
2. Atomize obligations and record their source and consequence.
3. For P2, copy `templates/authoring-card.md` into the work package, complete its observations, judgment inputs, owners, artifacts, and terminals, then project approved decisions into the canonical spec and obligation ledger. The card is an authoring aid, not a second behavior source.
4. Design ASK, WAIT, ROUTE, BLOCK, and DONE terminals first.
5. Define observations and domains.
6. Define guards and bypass evidence.
7. Define stages, tables, effects, and order.
8. Define formats, templates, and examples.
9. Write judgment-only body sections.
10. Add positive, negative, counterexample, and mutation fixtures.
11. Generate the thin loader and platform metadata.
12. If the user requested a README, read [readme-authoring.md](readme-authoring.md) and write it from the implemented behavior and available evidence. Do not treat the guide as a fixed section template.
13. Run L-fast, L-structural lint, L-full build, and behavior evaluation.

The obligation ledger is provenance, not a second behavior source. Keep original intent text immutable inside each atom and point `targets` to the canonical implementation and `evidence` to its check. Supported locators are `file:<relative-path>`, `body:<section-ref>`, `spec:<GROUP>/<stable-id>` (or `spec:TABLES/<table>/<row>`), `fixture:<id>`, and `eval:<id>`. Mark an atom `projected` only after both locators resolve. If an atom is still ambiguous, leave it `review-required` and keep the P2 `DEFERRED` gate.

## Maintenance

Address stable IDs, not prose locations. Before a change, query affected predicates, stages, rows, body sections, templates, owners, fixtures, and generated artifacts. After a change, review the semantic diff as well as the line diff.

## Completion boundary

Creation is structurally complete only when lint and build pass. Behavior is verified only when forward tests provide evidence. A new skill remains an initial release candidate until real use confirms its trigger, adherence, outputs, and maintenance locality.
