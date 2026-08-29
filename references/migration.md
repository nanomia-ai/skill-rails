# Conservative migration

## Contents

- Boundary
- Ledger
- Classification
- Stop conditions
- Deletion rule

## Boundary

Do not execute an imported `spec.mjs` before source validation and build. Do not modify the source project during a read-only pilot. Copy or generate only into the user-approved destination.

## Ledger

Append migration atoms to the canonical `.skill-rails/obligation-ledger.json` before semantic conversion. Inventory every regular source file once using the shared `.git`, `node_modules`, and `.skill-rails` exclusion boundary. Markdown files produce parser-backed semantic atoms: frontmatter metadata; headings and their heading context; paragraphs; list items, including nested items and multiline continuations; GFM table rows; fenced-code, code, HTML, and thematic-break blocks; and parser-consumed reference definitions. Each non-Markdown file produces exactly one conservative `file-text` or `file-opaque` review atom rather than a semantic parse; UTF-8 text keeps exact raw text and byte hash, while opaque files keep byte hash, byte count, and an instruction to preserve, map, or dispose explicitly. Record the exact source path, span, hash, raw text or opaque instruction, byte count when applicable, context, candidate class, consequence, confidence, rationale, target, fixture or review evidence, and disposition. Every migration atom remains `review-required` until explicitly disposed; do not create a second behavioral or migration ledger.

One source atom may map to multiple targets. Every target must map back to a source atom or an explicit new approval receipt.

## Classification

Use: judgment/body, observation/collector, guard, stage/done/evidence, table row, format, template, example, order, ownership, artifact, role, declaration, deferred, duplicate, obsolete, or ambiguous/review-required.

Classification hints may identify deterministic source structure, but they must abstain to `ambiguous/review-required` when that structure is not safely inferable; an unrecognized atom is not judgment merely by default.

Move exact formats first, then observable predicates, then stages, guards, and effect order. Leave genuine judgment in body. Leave machine-decidable rules without collectors in `DEFERRED` with an owner, fixture, and removal condition.

## Stop conditions

Stop for human review when consequence is high and confidence is low, when a source atom has no defensible destination, when a new target has no provenance, or when old and new scenarios disagree without an approved behavior change.

## Deletion rule

Do not delete source prose until source-to-target coverage and reverse provenance are complete, critical review-required entries are zero, old/new scenarios have been compared, and deletion is separately approved.
