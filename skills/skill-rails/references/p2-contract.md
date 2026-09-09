# P2 runtime contract

The current P2 wire/spec lineage remains `SPEC.version = "5"` for compatibility. This is not the Skill Rails package release version, and it does not name a separate product generation.

## Contents

- Canonical ownership
- Closed exports
- Observation values
- Evaluation rules
- Body and templates
- Validation levels
- Runtime CLI

## Canonical ownership

`spec.mjs` exclusively owns observable conditions, guards, stage order, decision tables, effect order, ownership, and completion evidence. It owns an exact format only where `FORMATS` can express it: `line` and `progressLine` build one machine-readable line, `<timestamp> <head>: field: value; field: value`, and those get golden fixtures, round-trip and fuzz checks. Any other exact shape — multiline, tabular, or repeated items — belongs to a template, which is checked for structure but carries no field grammar. Do not read this as a promise that every exact format can live in `spec.mjs`. `body.md` owns judgment criteria and reasons. Templates own output shape. Collectors observe and normalize but never decide policy. That is an authoring rule: L2 checks a collector module structurally, its exports, collector names, and arity, and never inspects what a collector computes; guard, stage, and table selection stay with the spec's predicates. A stage caller may supply one optional project-relative file target through API `targetPath` or CLI `--target`; after runtime normalization and containment validation, collectors and `snapshotBasis` receive it as `ctx.targetPath`. It is neither a judged input nor a decided domain value, and it reaches a Decision only through declared collector observations.

## Closed exports

Every P2 spec exports exactly these names, including empty values:

`SPEC`, `OBSERVATIONS`, `FORMATS`, `TEMPLATES`, `ORDERS`, `OWNERSHIP`, `GUARDS`, `STAGES`, `TABLES`, `ARTIFACTS`, `ROLES`, `READ_FIRST`, `DECLARATIONS`, `DEFERRED`.

All predicates declare `reads`. The validator derives state reads from the AST and requires exact agreement.

`ORDERS` is reserved in the version-5 lineage and is not enforced: no runtime or validator rule consumes it. Effect order is owned by each stage's effect plan. Record a sequence there if it must hold; an `ORDERS` entry earns no enforcement credit.

## Observation values

- `KNOWN(value)`: a domain-valid value was observed.
- `NONE`: absence was positively observed.
- `UNKNOWN(reason)`: the value could not be observed reliably.

UNKNOWN is not false. Only fields listed in `acceptsUnknown` may receive it inside a predicate. A `judged` or `decided` value binds to a snapshot only when it carries an `@sha256:<prefix>` suffix: a suffixed value is compared with the current snapshot fingerprint and rejected on mismatch, a bare value is accepted against any snapshot, fixture inputs are never compared, and the Decision seals the snapshot fingerprint either way. A guard bypass reads collector-observed evidence only: L18 rejects a `judged` or `decided` field in an `unless` predicate's `reads`. It does not require a bypass to read anything, so an `unless` with empty `reads` bypasses unconditionally; the durable evidence a bypass depends on is yours to declare.

For the version-5 lineage, the exact raw string `"UNKNOWN"` is a reserved compatibility spelling of `UNKNOWN(reason)` in every top-level observation domain; it is not a known path, text, JSON string, or enum member. New collectors should return the runtime's branded `UNKNOWN` or `unknown(reason, details)` value instead of relying on that raw spelling. Scenario fixtures put collector-owned values only in `s`, judged values only in `judged`, and decided values only in `decided`. Live collection, simulation, scenario validation, and exclusive-table validation all normalize those lanes into the same complete observation snapshot before any predicate runs; a missing value remains UNKNOWN and cannot earn predicate or coverage credit unless the predicate explicitly declares `acceptsUnknown`.

`ARTIFACTS` owns static project-relative consumer path declarations. Its `writer` is the skill id, a declared role, or a named `external.*`/`project.*` actor; its `readers` may name stages, guards, roles, or external/project consumers. The current Decision projects entries read by its selected stage or stopping guard as `stage_artifacts`. A declaration proves neither that the path currently exists nor that its contents are valid or fresh; collect and verify those facts separately when the behavior requires them. Non-file observations do not declare null or placeholder artifacts.

## Evaluation rules

Evaluate guards in array order. ASK, BLOCK, and `ROUTE:<target-id>` stop; RESTRICT accumulates forbidden effect verbs and continues. Evaluate stages in order and select the first whose `done` is not true, with one exception: a stage with `needs` whose selected branch is exactly `["NEXT"]` is passed over as if done, so an effect-free branch cannot loop the caller. A stage owns either a `record` or `reentry`. Every effect plan ends in exactly one of NEXT, ASK, WAIT, BLOCK, DONE, or `ROUTE:<target-id>`.

Within a selected effect plan, effects are consumed in array order and a terminal stops the plan only when reached; a terminal final status never discards prefix effects.

`Decision.reinvoke` projects the only authorized continuation from that Decision. `after-effects` follows an effect plan ending in NEXT; `recompute` follows a stale snapshot; and `after-authoring` leaves runtime evaluation for the canonical authoring/rebuild path. `after-input` is derived only for an effect-free BLOCK whose non-empty `needs` are all caller-supplied `judged` or `decided` fields. It stops the current invocation but permits the same run to be evaluated again after every requested value is obtained from its proper authority and supplied explicitly. Within the same unchanged package, project, normalized target, and stable snapshot, the runtime carries forward the normalized caller inputs self-sealed with the immediately preceding `after-input` Decision and that exact context, then merges the newly requested fields; a current explicit value replaces the retained value for that field. It does not search older Decisions or carry inputs across a stale, terminal, differently authorized, metadata-free, unsealed, or otherwise changed context. These retained values remain caller inputs, never observed facts or effect evidence. A bare repeat is not progress. A BLOCK with any collector-owned or other need source, a mixed-source BLOCK, and a terminal Decision keep `reinvoke: null`.

An `artifact` argument resolves against `<project>` through its `ARTIFACTS` declaration. Build validates every `READ_FIRST` path as a portable package-relative spelling that exists as a regular file inside the package, because `enter` reads it; a sibling package is not addressable from it. Build closes only the references the runtime actually resolves. A stage effect's `artifact`, `template`, and `format` are projected into the Decision on any verb, so they must be declared; `role` is checked only on `DISPATCH`, which requires a declared role, and on any other verb it passes through like any other argument. Every other effect argument, `path` included, is rendered into the model's instruction verbatim and reserves no meaning, so build does not require one to name a package file. A role is rendered as a standalone command that projects no artifacts, so only its `returns` template is resolved and checked.

The runtime calculates and validates effect plans; it does not claim to intercept model tool calls. Without trusted harness evidence, execution adherence remains checked or unproven, never enforced.

## Body and templates

Body level-two headings are only `guard:`, `stage:`, `role:`, or `why:`. Do not duplicate procedure, branch conditions, effect order, exact formats, or quantities in body prose. Lint enforces only part of that rule: L8 flags an effect verb followed by `→` on the same line, a quantity keyword (`retry`, `repeat`, `maximum`, `at most`, `bytes`, `lines`, or their Korean spellings) next to a number, a dotted numeric identifier, a format head outside a `why:` section, and an ownership or artifact path literal. Paraphrased procedure and branch conditions pass lint. A stage section contains `Judgment:` and `Why:`. Templates show the exact shape and declare each placeholder as `line`, `block`, `list`, or `generated`. Those kinds are declaration labels: the build checks that the declared set matches the placeholders in the text and that each kind is a known word, and nothing more. The runtime hands the template to the model and never fills it, so no kind is enforced on the produced output and `list` carries no item grammar. State an item's shape inside the template itself.

## Validation levels

L-fast runs before every import and ignores the manifest as an authority. It checks the positive-list AST, forbidden syntax, imports, exact exports, acyclic local calls, typed comparisons, and derived reads. L-structural adds isolated import and L0-L18 structural checks for author feedback. L-full runs only at build and adds fixtures, mutation checks, determinism, format fuzz, and manifest generation.

## Runtime CLI

Resolve `<generated-skill>` to the generated P2 package containing `scripts/skill-rails/run.mjs`.

```text
node <generated-skill>/scripts/skill-rails/run.mjs enter --skill <generated-skill>
node <generated-skill>/scripts/skill-rails/run.mjs stage --skill <generated-skill> --project <project> [--target <project-relative-path>] [--trace-dir <external-state-dir> --run-id <id>] [--judged field=value] [--decided field=value]
node <generated-skill>/scripts/skill-rails/run.mjs simulate --skill <generated-skill> --fixture <fixture>
node <generated-skill>/scripts/skill-rails/run.mjs render --skill <generated-skill>
node <generated-skill>/scripts/skill-rails/run.mjs role --skill <generated-skill> --role <id>
node <generated-skill>/scripts/skill-rails/run.mjs lint --skill <generated-skill> [--fast]
node <generated-skill>/scripts/skill-rails/run.mjs record --skill <generated-skill> --decision <stage-result.json> --type effect_claimed --effect <Decision-effect-index>
node <generated-skill>/scripts/skill-rails/run.mjs record --skill <generated-skill> --decision <stage-result.json> --type <proof_recorded|receipt_recorded> --data-file <UTF-8-JSON-object>
node <generated-skill>/scripts/skill-rails/run.mjs record --skill <generated-skill> --decision <stage-result.json> --type artifact_verified --data-file <UTF-8-JSON-object> --artifact <path> --project <project>
node <generated-skill>/scripts/skill-rails/run.mjs align --skill <generated-skill> --decision <stage-result.json> [--trace <trace.jsonl>]
node <generated-skill>/scripts/skill-rails/run.mjs resume --skill <generated-skill> --trace <trace.jsonl> --project <project>
```

`<external-state-dir>` is external to two things, not one: put it outside the installed package and outside the repository or directory tree that contains the project being observed — the default Git basis runs `git status` over the whole working tree, so a sibling of the project inside the same repository is still observed. Runtime state inside the observed project leaves untracked files that the project's own snapshot then reads as its own state, so a run would change what it is measuring. The runtime refuses a directory inside the installed package, including through a symlink or junction. It does not police the project boundary — that one is yours to honor, and the generated loader already resolves `<trace-dir>` outside both.

Unsupported flags or input sources fail closed. Do not infer missing values or reconstruct a Decision from prose after a CLI or validation failure.

The current guide projects every `proof_required` entry as a `record inputs` object. A planned effect uses `--effect <index>` so the runtime takes the verb from the exact Decision. Other records use a bounded UTF-8 `--data-file`, normally stored in `<trace-dir>`: the guide supplies the matching `kind` and `reference` for `proof_recorded` or `receipt_recorded`, while `artifact_verified` supplies an artifact `{ base: "<project>", path }` that the caller resolves under the selected project before passing the resolved path with `--project`. Extra JSON properties remain annotations. `--effect` may accompany one data source to preserve metadata, but any supplied `index` or `verb` must match the selected Decision effect. The older `--data <json>` path remains supported for direct argv/API callers, including arbitrary annotations and unplanned or restricted-effect confessions, but it is not a portable shell transport and generated guidance does not use it. `--data-file` and `--data` are mutually exclusive. Malformed, unreadable, oversized, or non-object caller data, an invalid effect selector, a conflicting effect binding, or an incomplete artifact record fails before trace mutation with an input or evidence diagnostic; it is not reported as `SR_INTERNAL`. Generic claims and receipts remain permissive weak evidence for compatibility; fields that do not match the Decision cannot satisfy alignment.

`--target` is optional and only valid on `stage`. Supply it when the current task or role has already selected one file target that the package's collectors need; do not search for or infer one. The API spelling is `targetPath`. The runtime accepts a non-empty portable relative path, removes only empty and `.` segments, rejects absolute paths, backslashes, drive-like colons, and every `..` segment, then checks lexical and realpath containment below `projectRoot`. It does not prove that the target exists, is a regular file, or has valid or fresh contents; collectors own those observations. When tracing is enabled, `decision_emitted.data.targetPath` records that normalized value and `resume` carries it into the next stage command; without a target, the trace data and command retain their previous shape. This is trace continuity, not a Decision field or a requirement to keep the same target for later stages. Packages that do not require a selected target omit the input and retain the previous collector context.

A traced `stage` writes the complete UTF-8 `skill-rails/stage-result/1` envelope to `<external-state-dir>/<run-id>.stage-result.json` before returning and reports that path as `result_path`. A legitimate same-run evaluation replaces this current-result file; the append-only trace preserves prior emitted Decisions. A diagnostic does not replace it, so a rejected duplicate cannot destroy the last usable result. This file is the input to `record` and `align`; shell redirection is unnecessary.

`resume` is historical trace lookup, not Decision re-evaluation or freshness proof. Its `skill-rails/resume/2` report always returns the last emitted Decision and a `reason`; `next_command` is non-null only for `after-effects` and `recompute`, where it is an exact traced `stage ... --json` command and preserves a recorded target. For `after-input`, the required sources, fields, and domains remain in `last_decision.needs`, but `next_command` is null because the runtime cannot invent their values. It is also null for `after-authoring`, terminal Decisions, and non-continuable BLOCKs.
