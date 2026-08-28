# Authoring workflow

## Contents

- Intent brief
- Fresh-consumer closure
- Profile selection
- Creation order
- Maintenance
- Completion boundary

## Intent brief

Start from `templates/intent-brief.json`; its keys are the input contract and its requirement arrays intentionally start empty so placeholders cannot become obligations. Record the problem, positive use cases, near-miss triggers, inputs, outputs, irreversible boundaries, state-dependent behavior, exact formats, external dependencies, evidence of completion, judgment points, and deterministic helpers. Ask only when an answer changes a product boundary or an irreversible action.

Keep a judgment point as a string when every invocation needs it. When a large P0 or P1 skill has a prose topic that applies only under a distinct condition, record it as `{ "id": "stable-kebab-id", "when": "one-line condition", "points": ["preserved requirement", "another requirement"] }`. The profile does not change: conditional prose routing is orthogonal to P0/P1 mechanics. Do not mechanically split prose by length. Use a topic only when its condition is meaningful, its points form one coherent subject, and the always-loaded entry still contains universal boundaries, state-dependent obligations, exact formats, and stop rules.

## Fresh-consumer closure

Author each generated skill, and each durable output intended for later AI consumption, for a session that has not seen the authoring or producing conversation. Do not rely on prior-session memory, undocumented project history, or an earlier agent's unrecorded inference.

Judge sufficiency over the smallest declared consumption set, not over each file in isolation:

- For a generated skill, the consumption set is the current task, its declared input artifacts, `SKILL.md`, and only the material that `SKILL.md` explicitly directs the AI to read for this invocation or that P2 `enter`, `READ_FIRST`, and the current Decision supply.
- For a durable task output intended for later AI consumption, the consumption set is the output plus only the durable dependencies that the output identifies precisely.

The consumption set defines only what must suffice for correct interpretation; it neither defines nor restricts the files, tools, or evidence used to perform the domain work.

Together, that consumption set must provide the information the new AI needs to interpret and use the skill or output correctly. Depending on the skill or output, that may include its purpose, skill-defined internal terms, input identity and scope, constraints, evidence or uncertainty, current result or status, and next action. Define a skill-defined internal term at or before its first use on the mandatory reading path, or route through a mandatory definition before that use. Put shared context on a mandatory path and local context in the selected topic, body, template, or output. Do not compensate for missing context by duplicating all background in every file, adding unrelated material to the consumption set, or telling the AI to scan unrelated files.

If correct interpretation still requires conversation-only knowledge or an undeclared artifact, the consumption set is incomplete. Persist the missing fact in its owning artifact or declare the precise durable dependency before treating the work as complete.

## Profile selection

- P0: judgment and concise guidance only. Do not create `spec.mjs`.
- P1: exact formats or deterministic helpers, scripts, templates, or validators are useful, but no state machine is required.
- P2: use when state-dependent branches, guards, ordered effects, exact formats, or evidence-gated completion repeat.

Do not choose P2 merely because the source is long. The generator records the selected profile, signals, and reasons in `.skill-rails/profile-decision.json`; `.skill-rails/intent.json` remains the canonical input.

For P0/P1, conditional judgment topics generate a small `references/guidance-index.md` and one Markdown file per stable topic. `SKILL.md` tells the using AI to read the index and open only matching topics. The index owns active routing conditions; topic files own their prose; the obligation ledger points back to both. Plain string judgment points stay in `SKILL.md`. Missing routing material fails lint. This is model-readable progressive disclosure, not a state machine or a host permission boundary.

Express a required correlation as declared-reads table conjuncts before adding runtime machinery: table rows are fixture-covered, exclusivity-checked, and mutation-killed, while a new runtime mechanism is invisible to those checks.

This contract does not create a second migration ledger or a progressive query layer over migration atoms. It also sets no universal token threshold: `eval.mjs` reports deterministic byte surfaces, while fresh consumer runs must establish whether a model selected the right topics and avoided unrelated ones.

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

Every generated P2 package reserves a package-root `.gitattributes` with exact bytes `* -text\n`. The builder emits its owned runtime and schema text with LF, then records exact raw hashes including `.gitattributes` in `generated_files`; verification never normalizes bytes, and Git checkouts preserve every sealed file instead of applying platform newline conversion. A pre-existing noncanonical file is a collision and is never overwritten or merged; an unowned file with the canonical bytes requires an explicit `--repair-generated` rebuild to transfer ownership. P0 and P1 package shape is unchanged.

Resolve every project-relative path a collector accepts through a canonical realpath containment check before reading or hashing it; a lexical relative-path test accepts a symlink or junction that escapes the project.

The obligation ledger is provenance, not a second behavior source. Keep original intent text immutable inside each atom and point `targets` to the canonical implementation and `evidence` to its check. Supported locators are `file:<relative-path>`, `body:<section-ref>`, `spec:<GROUP>/<stable-id>` (or `spec:TABLES/<table>/<row>`), `fixture:<id>`, and `eval:<id>`. Mark an atom `projected` only after both locators resolve. If an atom is still ambiguous, leave it `review-required` and keep the P2 `DEFERRED` gate.

## Maintenance

Address stable IDs, not prose locations. Before a change, query affected predicates, stages, rows, body sections, templates, owners, fixtures, and generated artifacts. After a change, review the semantic diff as well as the line diff.

Update the AI-facing body sections and stage references in the same transaction as any binding change: structural validation cannot see prose drift, so a package passes L0–L18 while its shipped reference still instructs a cold model to look for a retired mechanism. Delete a retired fixture in the same transaction that retires its mechanism, or it stays manifest-bound and reads as live behavior.

For an intent-backed P0/P1 package, pass `maintain.mjs` a change containing only `update-intent` operations. It first refuses to overwrite a `SKILL.md`, adapter, index, or topic file that differs from the current intent-derived projection. Record that meaning in intent or move separately owned material before retrying. It then updates the intent and ledger, regenerates those projections and evaluation cases atomically, and leaves an authored P1 helper or other package files unchanged. For an auto-profiled package, maintenance stops if the updated intent would select a different profile and requires explicit regeneration instead of silently changing package shape. An explicit profile decision remains pinned and auditable. P2 maintenance keeps using stable-ID body, resource, spec, and intent operations followed by its semantic diff and rebuild.

For a whole-file P2 replacement, use `replace-artifact` with `profile: "p2"`, the registered `kind` and canonical package-relative `path`, the current `expected_hash`, and string `content`. The closed first-slice registry accepts only `spec` at `spec.mjs`, `collector` at `collectors/index.mjs`, and an existing `reference` below `references/`; it requires one forward-slash spelling with no empty or dot segments and the target's physical case, and it refuses generated files, duplicate physical targets, absent targets, stale hashes, cross-kind paths, symlinks, junctions, and unsupported directory entries before applying any replacement. Maintenance stages and builds the complete regular-file package, renames the original root to a captured backup, verifies that captured backup against the starting fingerprint, and only then installs the stage. Its atomic, recoverable boundary assumes one authorized writer with exclusive ownership of the package root: it detects pre-install identity drift and, on rollback obstruction, leaves the captured backup at the exact path reported by the error instead of deleting it or an occupying target. It neither locks out nor guarantees preservation from an out-of-band process that continues writing after capture; external concurrency is outside the verified boundary, and missing host-ownership evidence is `UNPROVEN`, not success. Cross-platform locking of external processes is host authority and would materially complicate the AI-facing tool. Body-section, intent-patch, template, and resource-creation operations keep their existing semantics and are not widened into arbitrary source replacement.

## Completion boundary

Replace a status or verification report with its current truth instead of appending a new dated section beside superseded claims, and let every published hash or count name the command that reproduces it.

Creation is structurally complete only when lint and build pass. Behavior is verified only when forward tests provide evidence. A new skill remains an initial release candidate until real use confirms its trigger, adherence, outputs, and maintenance locality.
