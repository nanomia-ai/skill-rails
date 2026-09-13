# Canonical Verification Predicates

This document defines only the revision and event disk predicates shared by verify and
resume. Task-card interpretation follows the Canonical State Predicates read alongside
this companion.

## Verification revision predicates

- Product revision: output of `git hash-object devflow/project/product.md`.
- Verification revision: give `git ls-tree -r -z --full-tree HEAD --` exactly
  `devflow/project/arch.md`, `devflow/project/code-style.md`, and
  `devflow/project/glossary.md` when present. Pass its raw stdout bytes unchanged to the
  stdin of `git hash-object --stdin`.
- Code revision: output of `git log -1 --format=%H -- . ':(exclude)devflow/**'`; use `none`
  when it has no output.
- Capability revision: capability layer only. In HEAD, find exactly one folder whose path
  normalized by removing status suffixes equals the target capability-folder locator.
  Resolve every target `.done.` task card below that HEAD folder and every direct `Depends`
  card of those cards. Parse dependencies by the canonical state predicates. Give only the
  exact HEAD paths of those target and direct-dependency cards to
  `git ls-tree -r -z --full-tree HEAD --`, then hash by the Verification-revision method.
  Git performs path deduplication and tree ordering. If the folder, any target card, or any
  dependency does not resolve exactly, the value is `unresolved`.

For both tree-input revisions, never decode, reorder, or newline-convert Git's NUL-bearing
stdout. Use a native binary pipe on POSIX. In Windows PowerShell, run that same pipe inside
`cmd /d /s /c`; never use the PowerShell object pipeline.

## Verification event predicates

Automatic events arise only from the following keys and conditions in a current-format
verify.md. If the same key has a pending, awaiting-user-decision, routing, or completed
state, do not create it again.

| Role | Event key | Due when |
|---|---|---|
| Audit | `product` | tree-root verify.md has a product-layer verdict and Audit has no entry with that key |
| Audit | `post-failure through <largest source id among failure entries>` | the capability folder is `.done`, Failure history has at least one `failure:` entry, and Audit has no entry with that key |
| Retrospective | `first closure <capability number>` | the capability folder is `.done` and Retrospective has no entry with that key |
| Retrospective | `product` | tree-root verify.md has a product-layer verdict and Retrospective has no entry with that key |

A user-request event key is its journal request-line timestamp. For the same role and
target, if an unresolved request line or verify.md event timestamp already equals the
current UTC second, add one second until the value is unused and write that timestamp on
the new request line. Never give two requests for the same role and target the same key.

A verify.md missing any of the four revision fields is a pre-v0.9.21 record. Exclude it
from current failure routing, pass reuse, and automatic-event derivation; do not add its
missing revision fields merely for upgrade. When processing a user-request event against that record, add any
missing `## Audit` and `## Retrospective` sections with `- not run` in the same pending-
event commit. The next actual verification overwrites the record in current format while
preserving those new event sections. Legacy scalar `Audit:` and `Retrospective:` values
neither trigger nor suppress current events; their old content remains in git history.
