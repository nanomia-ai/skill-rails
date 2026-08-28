# P2 V5 contract

## Contents

- Canonical ownership
- Closed exports
- Observation values
- Evaluation rules
- Body and templates
- Validation levels
- Runtime CLI

## Canonical ownership

`spec.mjs` exclusively owns observable conditions, guards, stage order, decision tables, effect order, exact formats, ownership, and completion evidence. `body.md` owns judgment criteria and reasons. Templates own output shape. Collectors observe and normalize but never decide policy.

## Closed exports

Every P2 spec exports exactly these names, including empty values:

`SPEC`, `OBSERVATIONS`, `FORMATS`, `TEMPLATES`, `ORDERS`, `OWNERSHIP`, `GUARDS`, `STAGES`, `TABLES`, `ARTIFACTS`, `ROLES`, `READ_FIRST`, `DECLARATIONS`, `DEFERRED`.

All predicates declare `reads`. The validator derives state reads from the AST and requires exact agreement.

## Observation values

- `KNOWN(value)`: a domain-valid value was observed.
- `NONE`: absence was positively observed.
- `UNKNOWN(reason)`: the value could not be observed reliably.

UNKNOWN is not false. Only fields listed in `acceptsUnknown` may receive it inside a predicate. `judged` and `decided` values are bound to a snapshot. A guard bypass must use collector-observed durable evidence, never a model-supplied judgment or decision alone.

`ARTIFACTS` owns static project-relative consumer paths. Its `writer` is the skill id, a declared role, or a named `external.*`/`project.*` actor; its `readers` may name stages, guards, roles, or external/project consumers. The current Decision projects entries read by its selected stage or stopping guard as `stage_artifacts`. Non-file observations do not declare null or placeholder artifacts.

## Evaluation rules

Evaluate guards in array order. ASK, BLOCK, and ROUTE stop; RESTRICT accumulates forbidden effect verbs and continues. Evaluate stages in order and select the first whose `done` is not true. A stage owns either a `record` or `reentry`. Every effect plan ends in exactly one of NEXT, ASK, WAIT, ROUTE, BLOCK, or DONE.

The runtime calculates and validates effect plans; it does not claim to intercept model tool calls. Without trusted harness evidence, execution adherence remains checked or unproven, never enforced.

## Body and templates

Body level-two headings are only `guard:`, `stage:`, `role:`, or `why:`. Do not duplicate procedure, branch conditions, effect order, exact formats, or quantities in body prose. A stage section contains `Judgment:` and `Why:`. Templates show the exact shape and use typed placeholders: `line`, `block`, `list`, or `generated`.

## Validation levels

L-fast runs before every import and ignores the manifest as an authority. It checks the positive-list AST, forbidden syntax, imports, exact exports, acyclic local calls, typed comparisons, and derived reads. L-structural adds isolated import and L0-L18 structural checks for author feedback. L-full runs only at build and adds fixtures, mutation checks, determinism, format fuzz, and manifest generation.

## Runtime CLI

Resolve `<generated-skill>` to the generated P2 package containing `scripts/skill-rails/run.mjs`.

```text
node <generated-skill>/scripts/skill-rails/run.mjs enter --skill <generated-skill>
node <generated-skill>/scripts/skill-rails/run.mjs stage --skill <generated-skill> --project <project> [--trace-dir <external-state-dir> --run-id <id>] [--judged field=value] [--decided field=value]
node <generated-skill>/scripts/skill-rails/run.mjs simulate --skill <generated-skill> --fixture <fixture>
node <generated-skill>/scripts/skill-rails/run.mjs render --skill <generated-skill>
node <generated-skill>/scripts/skill-rails/run.mjs role --skill <generated-skill> --role <id>
node <generated-skill>/scripts/skill-rails/run.mjs lint --skill <generated-skill> [--fast]
node <generated-skill>/scripts/skill-rails/run.mjs record --skill <generated-skill> --decision <stage-result.json> --type <effect_claimed|proof_recorded|receipt_recorded> [--data <json>]
node <generated-skill>/scripts/skill-rails/run.mjs record --skill <generated-skill> --decision <stage-result.json> --type artifact_verified --artifact <path> --project <project>
node <generated-skill>/scripts/skill-rails/run.mjs align --skill <generated-skill> --decision <stage-result.json> [--trace <trace.jsonl>]
node <generated-skill>/scripts/skill-rails/run.mjs resume --skill <generated-skill> --trace <trace.jsonl> --project <project>
```

Unsupported flags or input sources fail closed. Do not infer missing values or reconstruct a Decision from prose after a CLI or validation failure.
