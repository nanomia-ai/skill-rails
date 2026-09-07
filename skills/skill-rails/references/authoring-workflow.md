# Authoring workflow

## Contents

- Intent brief
- Authoring judgment
- Role-separated work
- Related skill suites
- Fresh-consumer closure
- Profile selection
- Creation order
- Maintenance
- Plan and completion boundaries

## Intent brief

Start from `templates/intent-brief.json`; its keys are the input contract and its requirement arrays intentionally start empty so placeholders cannot become obligations. Record the problem, positive use cases, near-miss triggers, inputs, outputs, irreversible boundaries, state-dependent behavior, exact formats, external dependencies, evidence of completion, judgment points, and deterministic helpers. While completing the intent brief, ask only when an answer changes a product boundary or an irreversible action.

Preserve wording the user chose to carry intent, force, a distinction, or a failure consequence. Translation may change the language, but it must not soften that wording into generic best practice, collapse a distinction, or make a different interpretation plausible. When concise wording cannot preserve the meaning, retain the original expression with enough context to interpret it. The obligation ledger can preserve only the text it receives; it cannot recover intent that was already normalized away.

Keep a judgment point as a string when every invocation needs it. When a large P0 or P1 skill has a prose topic that applies only under a distinct condition, record it as `{ "id": "stable-kebab-id", "when": "one-line condition", "points": ["preserved requirement", "another requirement"] }`. The profile does not change: conditional prose routing is orthogonal to P0/P1 mechanics. Do not mechanically split prose by length. Use a topic only when its condition is meaningful, its points form one coherent subject, and the always-loaded entry still contains universal boundaries, state-dependent obligations, exact formats, and stop rules.

## Authoring judgment

Build a skill for a person and an unfamiliar AI to use, not merely for a technically valid experiment. Anchor the design in the user's desired result, why that result matters, the failure that made the work necessary, and the role the skill plays in the larger flow; then work backward from the first useful result. A structurally valid package that leaves a cold AI unable to understand what it is looking at, where to go next, or what good means is not a complete result.

Prefer the smallest coherent change that reaches the full desired level. Small does not mean passive, local, or lower quality: find the most accurate owning boundary, replace the mistaken premise or wording there, and leave the whole result cleaner than before. Do not accumulate a patchwork of case-specific prohibitions, explanations, validators, and recovery procedures when one natural correction at the owner would solve the class of problem. Mechanize rules that are repeatable and can be checked reliably; keep interpretation, tradeoffs, and value judgment in concise prose with enough background to prevent misunderstanding. Do not optimize for brevity itself.

Give the authoring AI a problem space in which it can judge, not an answer key it can imitate or evade. Supply the purpose, background, relationships, important original wording, observed failure, desired direction, values to preserve, uncertainty, and judgment boundaries. State exact mechanics where they are exact, but do not turn every past failure into another step-by-step route. A safeguard should be a wall encountered on a meaningful drift path, not a detailed manual that replaces normal reasoning.

Before repairing a local symptom, understand the relevant project purpose, common contract, file and state flow, canonical owner, generated projection, and direct consumer. Decide whether the defect belongs to the local skill, a shared owner, a tool, a fixture, a harness, an environment, or an agent-role mismatch. Treat implementations, history, tests, and failures as evidence, not answer keys. Keep each behavior or fact owned by one canonical source; other surfaces should route to or project from that owner instead of becoming parallel truths. A repair must remain natural for the other valid flows that share that owner.

For a high-cost decision, compare the simplest workable alternative and one genuinely independent approach before extending the current design. Use a fresh review when it can challenge the framing, not merely optimize inside it. As evidence changes, improve how the problem is being solved, not only the current implementation; consistency with an earlier plan is not a goal. When work stops bringing the desired result closer, or the same class of correction recurs without new behavior evidence, step back from the symptom and re-examine the framing, root cause, owner, consumer path, and simpler alternatives. Replace the approach when its premise no longer holds; ordinary local fixes need no reframing. In a long session, when the original purpose may be fading, briefly restate the result, why the current approach still serves it, and what evidence would change course—when useful, not on a schedule.

### Failure cases

These cases preserve causal patterns observed while building and maintaining complex skills; apply them by cause and outcome, not by surface resemblance:

- Exception rules, explanations, and tests were added around the same premise, but no new evidence showed the user's result improving. The work became larger without converging because the premise was never re-examined.
- An incomplete fixture or mechanical check was treated as the answer key, and the product was repeatedly changed to satisfy it. The test and implementation amplified the same false premise, so small changes became slower without better behavior.
- One agent's failure under constrained reasoning or an unsuitable role was generalized into instructions for every agent. Guidance and restrictions grew, other agents became more rigid, and the actual cause remained undiagnosed.
- A prompt was delivered and the agent said it understood, so work continued without checking the agent's working hypothesis, owner and consumer model, or actual progress. More harness was added around inadequate understanding, and the work entered a longer deadlock instead of becoming safer.
- A mechanism replaced prose, but its manual, exceptions, and recovery procedure grew larger than the prose it removed. Maintainers spent more context operating the mechanism, so drift and change cost remained instead of disappearing.

Before changing the product to satisfy a failed check, identify which premise broke — product, task or input artifact, fixture, check, harness, environment, or agent-role assignment — and repair the owning premise rather than making the product fit an invalid check. Before making a new check on authored work a hard gate, tie it to an owned deterministic contract and a concrete failure in current bytes, then test both sides: a real defect must fail and a differently shaped valid implementation must pass. If clearing the same red asks for another change to authored behavior, revisit the check's premise; the surface form or frequency of otherwise valid work is review evidence, not a product failure. After the design has logically converged, verify it with a high-information representative flow that exercises the coupled risks, then with a fresh agent using only the declared consumption set. Record what each check actually observed, and mark every remaining uncertainty `unproven`.

Generated guidance may carry a short recovery guard, but scope it to choices the target skill leaves to judgment. It must not authorize bypassing exact formats, mechanical rules, the current P2 Decision, evidence requirements, irreversible boundaries, or host permissions; detailed authoring history does not belong in every generated skill.

## Role-separated work

Role separation is a recommended operating pattern for demanding skill work, not a mandatory topology. The user's established pattern and explicit assignments take precedence. An agent that already received a role from the user or its assigning coordinator keeps that role; this default neither promotes it nor authorizes it to reassign itself or other agents. Keep four logical responsibilities understandable even when one agent carries more than one of them:

1. **Coordinator and supervisor (keeps the whole effort aligned):** preserves the original purpose and important wording, proposes the work and role allocation, watches actual state and convergence, resolves conflicts, and changes course or assignment when evidence requires it. When separate agents carry this responsibility, the coordinator owns direction, allocation, and decision gates; the supervisor inspects actual execution and evidence.
2. **Integrated implementer (the sole writer):** holds the connected implementation context, edits the canonical owners, integrates related changes as one coherent correction, and produces the diff and checks. Do not have another role edit the same owned files concurrently.
3. **Premise challenger and cross-checker (tries to disprove the approach):** independently tests the problem framing, root cause, owner, consumer path, and check assumptions against source and observed failures before or during implementation. This is a bounded, normally read-only role.
4. **Final whole-result reviewer (checks the completed result):** reads the original intent, the entire relevant diff and consumption path, and the executed evidence after convergence; it looks for drift, regression, duplication, missing context, and claims that remain unproven. It does not grade from the implementer's conclusion alone.

In a structured orchestration environment, the coordinator, supervisor, and long-running implementer can be distinct agents when the environment can sustain their state and communication; the four responsibilities may be distributed across those persistent agents and bounded reviewers. Outside such an environment, the primary agent keeps the long-running implementation and whole context. Use subagents for bounded read-only premise challenges, source checks, or final review rather than handing the integrated implementation to a short-lived subagent. A fresh, differently suited model may be used to break a persistent evidence conflict, but it is not a standing fifth role or a required step.

### Delegation readiness

A role-separated proposal is incomplete unless it tells the user both what intent-bearing context each agent will receive and how the coordinator or supervisor will observe adequate understanding before trusting the work. Prompt delivery and a claim of understanding are not evidence that an agent is ready for its role. Every assignment must carry the purpose, background, observed failure, important user wording, desired end direction, values and boundaries to preserve, current facts and uncertainty, relevant owner and consumer relationships, and completion condition—not only the conclusion or requested edit. If an agent delegates again, it must propagate the same intent-bearing core instead of reducing it to a one-line task.

Before relying on the work, the coordinator or supervisor checks the agent's actual working hypothesis, the state and evidence it inspected, the owner and consumer path it is acting on, its current output or progress, and what would make it change course. If those are materially missing or the work repeatedly stalls, repair the briefing or reassign the role before adding more rules or harness.

When role-separated work is proposed and the user has neither assigned models nor delegated that choice, offer a simple default allocation in the user's language after defining that readiness boundary. Explain each role in ordinary terms, name the capability needed for it, and ask whether to proceed with that allocation or let the user reassign it. Select by role fit, sufficient reasoning and context capacity, and current state—not by a permanent provider hierarchy. Do not assign a demanding role to a cheaper or faster model when known drift would require more harness and supervision than the saving justifies.

## Related skill suites

Skill Rails creates and maintains one standalone target skill at a time; choose P0, P1, or P2 for that skill, not for its plugin or repository. When several skills depend on the same domain material, preserve one repository-owned source rather than copying it into every package or making one generated skill invoke another. Each target skill's profile contract still owns how that skill behaves.

Put repeatable shared domain operations in one repository helper, validator, or harness and name that dependency and the check that observes it from each affected skill. Keep shared domain knowledge and judgment in one canonical document with a stable project-relative path and heading. Embed only the universal boundaries, stop conditions, and minimum interpretation that a cold user of the target skill needs on its declared consumption path; for the rest, state when and why the precise shared section is needed instead of loading the whole rulebook by default.

For P2, a shared file or helper is consumed domain input or implementation, not a second behavior source. The target skill's observable conditions, guards, stages, tables, ordered effects, ownership, and completion evidence stay in `spec.mjs`, as do the exact formats `FORMATS` can express; its judgment criteria and their framing stay in `body.md`. Naming a shared dependency grants it no behavior, judgment, freshness, or evidence authority.

For P0/P1, record that durable path and heading in `external_dependencies` so the generated guidance exposes the dependency. For P2, declare an external project input or context path once in `ARTIFACTS`, use a `project.*` or `external.*` writer, and name only the stages or guards that consume it as `readers`; the current Decision then supplies that declaration through `stage_artifacts`. `ARTIFACTS` selects a file path, not a heading, and proves neither that the file exists nor that its contents are valid or fresh. Keep the selected file small enough for its consumer, and project approved behavior or judgment into `spec.mjs` or `body.md` at its canonical owner.

A declared file path reaches only two places: inside the target package, or inside the consuming project. A sibling package of the same distribution is neither, so a suite's shared rulebook cannot be declared in `ARTIFACTS` or `READ_FIRST`, and an effect argument declares nothing. Until that changes, a suite states the shared document in `why:` prose using a `<skill-root>/../<sibling>/<path>` spelling, and the owning repository's own check enforces that every consumer carries it. Skill Rails neither resolves that spelling nor proves the document exists, is reachable in the installed layout, or is current. Put that sentence in the package's first `READ_FIRST` `why:` section, which is the first section `enter` renders: isolated fresh consumers followed the pointer from there in every observed run at a reference surface larger than most packages of the suite that uses it. A pointer placed later in the entry payload, a larger surface, a weaker model, or a context that has already been compacted is `unproven`.

This is an authoring boundary, not a workspace policy engine: Skill Rails does not validate an entire suite, propagate a shared edit across packages, or prove that an external dependency is current. Until repository-owned checks or fresh-consumer evidence observe those effects, report them as `unproven` rather than widening the core grammar.

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

For P1, make helper readiness observable rather than time-indexed: if the generated helper still emits `SR_P1_SCAFFOLD`, authoring is incomplete and use stops until the helper and its golden tests replace that scaffold.

Do not choose P2 merely because the source is long. In auto selection, `exact_formats` alone selects P1 and counts as a P2 signal only when `state_dependent_behaviors` is also present; `completion_evidence` alone never raises the profile. The generator records the selected profile, signals, and reasons in `.skill-rails/profile-decision.json`; `.skill-rails/intent.json` remains the canonical input.

For P0/P1, conditional judgment topics generate a small `references/guidance-index.md` and one Markdown file per stable topic. `SKILL.md` tells the using AI to read the index and open only matching topics. The index owns active routing conditions; topic files own their prose; the obligation ledger points back to both. Plain string judgment points stay in `SKILL.md`. Missing routing material fails lint. This is model-readable progressive disclosure, not a state machine or a host permission boundary.

Express a required correlation as declared-reads table conjuncts before adding runtime machinery: table rows are fixture-covered and exclusivity-checked, while a new runtime mechanism is invisible to those checks. Mutation credit is narrower than it sounds: the suite kills a fixed set of L-code cases declared in the package manifest, not one case per row.

This contract does not create a second migration ledger or a progressive query layer over migration atoms. It also sets no universal token threshold: `eval.mjs` reports deterministic byte surfaces, while fresh consumer runs must establish whether a model selected the right topics and avoided unrelated ones.

## Creation order

Apply the terminal, observation, guard, stage, table, and effect sequence below to P2. Keep P0/P1 thin by using only the steps their selected profile actually needs.

1. Write the intent brief and evaluation cases, preserving intent-bearing original wording and the failure consequence it explains.
2. Atomize obligations and record their source and consequence. Before committing to a high-cost design, challenge the problem framing, owner, consumer path, and evaluation premise with the relevant whole-system evidence.
3. For P2, copy `templates/authoring-card.md` into the work package, complete its observations, judgment inputs, owners, artifacts, terminals, and named consumer consumption sets, then project approved decisions into the canonical spec and obligation ledger. Put each static consumer artifact path in `ARTIFACTS`, bind it to its selected stage or stopping guard with `readers`, and place any required grammar on a mandatory structured or selected guidance surface. The card is an authoring aid, not a behavior source or consumer guidance.
4. Design ASK, WAIT, ROUTE, BLOCK, and DONE terminals first.
5. Define observations and domains.
6. Define guards and bypass evidence.
7. Define stages, tables, effects, and order.
8. Define formats, templates, and examples.
9. Write judgment-only body sections.
10. Add positive, negative, counterexample, and mutation fixtures.
11. Generate the thin loader and platform metadata.
12. Run L-fast, L-structural lint, L-full build, and behavior evaluation. Keep informed whole-result counterproof separate from blind fresh-consumer evaluation; each proves a different claim.

Every generated P2 package reserves a package-root `.gitattributes` with exact bytes `* -text\n`. The builder emits its owned runtime and schema text with LF, then records exact raw hashes including `.gitattributes` in `generated_files`; verification never normalizes bytes, and Git checkouts preserve every sealed file instead of applying platform newline conversion. A pre-existing noncanonical file is a collision and is never overwritten or merged; an unowned file with the canonical bytes requires an explicit `--repair-generated` rebuild to transfer ownership. P0 and P1 package shape is unchanged.

Resolve every project-relative path a collector accepts through a canonical realpath containment check before reading or hashing it; a lexical relative-path test accepts a symlink or junction that escapes the project.

When a task or role already selects one project-relative file for a stage, accept it through the public `targetPath` API / `--target` CLI input instead of reparsing argv, overloading judged or decided values, scanning for a likely file, or adding a package-specific side channel. The runtime validates and normalizes the path, exposes it as `ctx.targetPath` to observation collectors and `snapshotBasis`, and omits that property when no target was supplied. A collector may turn it into ordinary declared observations and snapshot material; the target itself is not a behavior rule, judgment, decision, existence proof, or freshness proof. A traced stage records the normalized value in `decision_emitted.data` so CLI `resume` can quote and resupply it; a target-less trace remains target-less, and callers may select a different target on a later stage invocation. Keep target input optional for packages that do not need caller-selected files.

The obligation ledger is provenance, not a second behavior source. Keep original intent text immutable inside each atom; for P0/P1, universal intent remains visible in the always-loaded `SKILL.md`, while `targets` name the canonical implementing `file:` and `evidence` names its resolving `file:` or `eval:` check (frontmatter description and routed topic text remain checked on their own guidance surfaces). P2 additionally resolves `body:`, `spec:`, and `fixture:` locators. Mark an atom `projected` only after its target and evidence resolve; otherwise leave it `review-required` and keep the P2 `DEFERRED` gate.

## Maintenance

First confirm that the reported problem exists in the current source, projection, consumer path, execution, or failure scene, then apply the attribution boundary in [Failure cases](#failure-cases) before editing the product. For a substantive change, use the role-separated pattern when the user selects it; otherwise cover the same premise and whole-result checks without claiming that they were independent. Keep one integrated writer in either case.

Address stable IDs, not prose locations. Before a P2 change, query affected predicates, stages, rows, body sections, templates, owners, fixtures, and generated artifacts:

```text
node "<skill-root>/scripts/maintain.mjs" --skill <folder> --diagnose --query <stable-id-or-text>
```

Pass the actual update as `--change <change.json>`. The file has one envelope, `{ "id": "<change-id>", "intent": "<why>", "operations": [...] }`, and each operation uses the smallest matching shape:

| Owner | Operation shape |
| --- | --- |
| canonical intent | `{ "type": "update-intent", "patch": { "<intent-field>": <value> } }` |
| existing P2 body section | `{ "type": "replace-body-section", "id": "stage: <id>", "content": "Judgment: ...\\n\\nWhy: ..." }` (add `"language": "ko"` for `body_ko.md`) |
| reference or template resource | `{ "type": "replace-resource", "path": "references/<file>.md" \| "templates/<file>.md", "content": "..." }` |
| registered whole P2 artifact | `{ "type": "replace-artifact", "kind": "spec|collector|reference", "path": "<canonical-path>", "profile": "p2", "expected_hash": "sha256:<current-hash>", "content": "..." }` |

Use only operations whose owner the change actually affects. After a change, review the emitted semantic diff as well as the line diff. The diff reports what changed, not which obligations claimed it: `projected` records locator resolution and provenance only, not semantic adequacy or behavior. A duplicate inside either locator list is one provenance edge, and many atoms may legitimately share a target; either pattern can invite review but does not fail the package by itself. When an edit touches a place obligations name, look those atoms up in the ledger and judge them yourself.

Update the AI-facing body sections and stage references in the same transaction as any binding change: structural validation cannot see prose drift, so a package passes L0–L18 while its shipped reference still instructs a cold model to look for a retired mechanism. Delete a retired fixture in the same transaction that retires its mechanism, or it stays manifest-bound and reads as live behavior.

For an intent-backed P0/P1 package, pass `maintain.mjs` a change containing only `update-intent` operations. It first refuses to overwrite a `SKILL.md`, adapter, index, or topic file that differs from the current intent-derived projection. Record that meaning in intent or move separately owned material before retrying. It then updates the intent and ledger, regenerates those projections and evaluation cases atomically, and leaves an authored P1 helper or other package files unchanged. Within a changed intent array, an obligation whose exact source coordinate and text are unchanged keeps its authored disposition and locators; edited, removed, or newly added atoms do not inherit that credit. For an auto-profiled package, maintenance stops if the updated intent would select a different profile and requires explicit regeneration instead of silently changing package shape. An explicit profile decision remains pinned and auditable. P2 maintenance keeps using stable-ID body, resource, spec, and intent operations followed by its semantic diff and rebuild.

For a whole-file P2 replacement, use `replace-artifact` with `profile: "p2"`, the registered `kind` and canonical package-relative `path`, the current `expected_hash`, and string `content`. The closed first-slice registry accepts only `spec` at `spec.mjs`, `collector` at `collectors/index.mjs`, and an existing `reference` below `references/`; it requires one forward-slash spelling with no empty or dot segments and the target's physical case, and it refuses generated files, duplicate physical targets, absent targets, stale hashes, cross-kind paths, symlinks, junctions, and unsupported directory entries before applying any replacement. Maintenance stages and builds the complete regular-file package, renames the original root to a captured backup, verifies that captured backup against the starting fingerprint, and only then installs the stage. Its atomic, recoverable boundary assumes one authorized writer with exclusive ownership of the package root: it detects pre-install identity drift and, on rollback obstruction, leaves the captured backup at the exact path reported by the error instead of deleting it or an occupying target. It neither locks out nor guarantees preservation from an out-of-band process that continues writing after capture; external concurrency is outside the verified boundary, and missing host-ownership evidence is `UNPROVEN`, not success. Cross-platform locking of external processes is host authority and would materially complicate the AI-facing tool. Body-section, intent-patch, template, and resource-creation operations keep their existing semantics and are not widened into arbitrary source replacement.

## Plan and completion boundaries

Replace a status or verification report with its current truth instead of appending a new dated section beside superseded claims, and let every published hash or count name the command that reproduces it.

Creation is structurally complete only when lint and build pass. Behavior is verified only when forward tests provide evidence. A new skill remains an initial release candidate until real use confirms its trigger, adherence, outputs, and maintenance locality.

At two drift-sensitive boundaries—before approving a substantive plan and before declaring its implementation complete—re-read the user's original purpose and the relevant Skill Rails guidance from their canonical paths, then counterprove the whole plan or result against them. At the plan boundary, test whether the proposed owner, scope, and verification still serve the intended result; at the implementation boundary, test the actual diff, consumer path, and evidence.

When role-separated work is selected and an independent reviewer is available, give that reviewer the original purpose and intent-bearing wording, observed failure, confirmed facts and uncertainties, owner and consumer relationships, approved scope, entire relevant diff, and executed evidence. The reviewer challenges both the premise and the result, consolidates blocking findings instead of creating a one-item correction loop, and distinguishes a defect from style preference or another valid form. Otherwise perform the same whole-result audit and report independent counterproof as `unproven`.

Then inspect the final whole as a cold user's working path, not only as files that exist: can an unfamiliar AI understand the purpose and current position, find the required depth, preserve the important boundaries, distinguish facts from uncertainty, and take the next action without conversation-only memory? Confirm that the change landed at the durable owner, did not become a patchwork of special cases or parallel truths, did not damage another valid flow, and remains proportionate to the meaning added. Report the checks actually run and every remaining unknown separately; missing practical evidence is `unproven`, never structural success.
