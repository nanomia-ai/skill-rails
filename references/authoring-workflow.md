# Authoring workflow

## Contents

- Intent brief
- Authoring judgment
- Fresh-consumer closure
- Profile selection
- Creation order
- Maintenance
- Completion boundary

## Intent brief

Start from `templates/intent-brief.json`; its keys are the input contract and its requirement arrays intentionally start empty so placeholders cannot become obligations. Record the problem, positive use cases, near-miss triggers, inputs, outputs, irreversible boundaries, state-dependent behavior, exact formats, external dependencies, evidence of completion, judgment points, and deterministic helpers. Ask only when an answer changes a product boundary or an irreversible action.

Keep a judgment point as a string when every invocation needs it. When a large P0 or P1 skill has a prose topic that applies only under a distinct condition, record it as `{ "id": "stable-kebab-id", "when": "one-line condition", "points": ["preserved requirement", "another requirement"] }`. The profile does not change: conditional prose routing is orthogonal to P0/P1 mechanics. Do not mechanically split prose by length. Use a topic only when its condition is meaningful, its points form one coherent subject, and the always-loaded entry still contains universal boundaries, state-dependent obligations, exact formats, and stop rules.

## Authoring judgment

Use this section to choose and review an authoring design. The user's purpose and preferences guide the design; the selected profile and runtime contracts govern execution until deliberately changed at their owning source. If they conflict, surface the incompatibility and revisit the profile or canonical owner instead of forcing one through the other. Ask the user only when the resolution changes a product boundary or irreversible action.

Start with the first useful result a user of the target skill must produce, then work backward. Mechanize rules that are repeatable and can be checked reliably; keep interpretation, tradeoffs, and value judgment in concise prose with enough context to prevent misunderstanding. Do not optimize for brevity itself. When the manual needed to understand or operate a mechanism grows larger or harder to use than the prose it replaces, reconsider the boundary and whether the mechanism is earning its cost.

For a high-cost decision, compare an independent alternative and the simplest workable alternative before extending the current design. Treat existing implementations, history, tests, and failures as evidence, not answer keys. Keep each behavior or fact owned by one canonical source; other surfaces should route to or project from that owner instead of becoming parallel truths.

Watch for nonconvergence: exceptions, explanations, and tests keep growing while no new evidence shows the first user result getting closer. Stop patching that layer and return to its parent premise, the user outcome, and the owning boundary; if the premise no longer holds, replace the approach. Do not turn one agent failure under constrained reasoning or an unsuitable role, or a structural pass without observed behavior, into universal machinery.

Before changing the product to satisfy a failed check, identify which premise broke — product, fixture, harness, or environment — and repair the owning premise rather than making the product fit an invalid check. After the design has logically converged, verify it with a high-information representative flow that exercises the coupled risks, then with a fresh agent using only the declared consumption set. Record what each check actually observed, and mark every remaining uncertainty `unproven`.

Generated guidance may carry a short recovery guard, but scope it to choices the target skill leaves to judgment. It must not authorize bypassing exact formats, mechanical rules, the current P2 Decision, evidence requirements, irreversible boundaries, or host permissions; detailed authoring history does not belong in every generated skill.

## Fresh-consumer closure

Author each generated skill, and each durable output intended for later AI consumption, for a session that has not seen the authoring or producing conversation. Do not rely on prior-session memory, undocumented project history, or an earlier agent's unrecorded inference.

Judge sufficiency over the smallest declared consumption set, not over each file in isolation:

- For a generated skill, the consumption set is the current task, its declared input artifacts, `SKILL.md`, and only the material that `SKILL.md` explicitly directs the AI to read for this invocation or that P2 `enter`, `READ_FIRST`, and the current Decision supply.
- For a durable task output intended for later AI consumption, the consumption set is the output plus only the durable dependencies that the output identifies precisely.

The consumption set defines only what must suffice for correct interpretation; it neither defines nor restricts the files, tools, or evidence used to perform the domain work.

For P2, complete `templates/authoring-card.md` with a named consumption set for each consumer. Declare every static project artifact that a selected stage or stopping guard requires once in `ARTIFACTS`, name that stage or guard in `readers`, and keep exact grammar in its structured format/template or selected guidance. The runtime projects those declared paths as the current Decision's `stage_artifacts`; non-file observations do not need placeholder artifacts. The authoring card and collector source are outside the generated skill's consumer consumption set: neither counts as consumer disclosure.

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
3. For P2, copy `templates/authoring-card.md` into the work package, complete its observations, judgment inputs, owners, artifacts, terminals, and named consumer consumption sets, then project approved decisions into the canonical spec and obligation ledger. Put each static consumer artifact path in `ARTIFACTS`, bind it to its selected stage or stopping guard with `readers`, and place any required grammar on a mandatory structured or selected guidance surface. The card is an authoring aid, not a behavior source or consumer guidance.
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

The obligation ledger is provenance, not a second behavior source. Keep original intent text immutable inside each atom; for P0/P1, universal intent remains visible in the always-loaded `SKILL.md`, while `targets` name the canonical implementing `file:` and `evidence` names its resolving `file:` or `eval:` check (frontmatter description and routed topic text remain checked on their own guidance surfaces). P2 additionally resolves `body:`, `spec:`, and `fixture:` locators. Mark an atom `projected` only after its target and evidence resolve; otherwise leave it `review-required` and keep the P2 `DEFERRED` gate.

## Maintenance

Address stable IDs, not prose locations. Before a change, query affected predicates, stages, rows, body sections, templates, owners, fixtures, and generated artifacts. After a change, review the semantic diff as well as the line diff.

Update the AI-facing body sections and stage references in the same transaction as any binding change: structural validation cannot see prose drift, so a package passes L0–L18 while its shipped reference still instructs a cold model to look for a retired mechanism. Delete a retired fixture in the same transaction that retires its mechanism, or it stays manifest-bound and reads as live behavior.

For an intent-backed P0/P1 package, pass `maintain.mjs` a change containing only `update-intent` operations. It first refuses to overwrite a `SKILL.md`, adapter, index, or topic file that differs from the current intent-derived projection. Record that meaning in intent or move separately owned material before retrying. It then updates the intent and ledger, regenerates those projections and evaluation cases atomically, and leaves an authored P1 helper or other package files unchanged. For an auto-profiled package, maintenance stops if the updated intent would select a different profile and requires explicit regeneration instead of silently changing package shape. An explicit profile decision remains pinned and auditable. P2 maintenance keeps using stable-ID body, resource, spec, and intent operations followed by its semantic diff and rebuild.

For a whole-file P2 replacement, use `replace-artifact` with `profile: "p2"`, the registered `kind` and canonical package-relative `path`, the current `expected_hash`, and string `content`. The closed first-slice registry accepts only `spec` at `spec.mjs`, `collector` at `collectors/index.mjs`, and an existing `reference` below `references/`; it requires one forward-slash spelling with no empty or dot segments and the target's physical case, and it refuses generated files, duplicate physical targets, absent targets, stale hashes, cross-kind paths, symlinks, junctions, and unsupported directory entries before applying any replacement. Maintenance stages and builds the complete regular-file package, renames the original root to a captured backup, verifies that captured backup against the starting fingerprint, and only then installs the stage. Its atomic, recoverable boundary assumes one authorized writer with exclusive ownership of the package root: it detects pre-install identity drift and, on rollback obstruction, leaves the captured backup at the exact path reported by the error instead of deleting it or an occupying target. It neither locks out nor guarantees preservation from an out-of-band process that continues writing after capture; external concurrency is outside the verified boundary, and missing host-ownership evidence is `UNPROVEN`, not success. Cross-platform locking of external processes is host authority and would materially complicate the AI-facing tool. Body-section, intent-patch, template, and resource-creation operations keep their existing semantics and are not widened into arbitrary source replacement.

## Completion boundary

Replace a status or verification report with its current truth instead of appending a new dated section beside superseded claims, and let every published hash or count name the command that reproduces it.

Creation is structurally complete only when lint and build pass. Behavior is verified only when forward tests provide evidence. A new skill remains an initial release candidate until real use confirms its trigger, adherence, outputs, and maintenance locality.
