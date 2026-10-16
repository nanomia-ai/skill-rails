---
name: natural-language-pilot-product-next
description: Turn the natural-language pilot Product request into its first brief without inventing decisions or replacing an existing brief. Use only for the natural-language pilot fixture contract.
---

# Author the Product brief

Work only in the given project root. The sole input is `pilot/product-request.md`, and the sole output is `pilot/brief.md`.

1. Check whether `pilot/brief.md` exists before reading or writing the output. If it exists, stop without changing it.
2. Read `pilot/product-request.md`. If it is missing or cannot be read, stop without creating the brief.
3. Prepare one brief with these sections:
   - `# Product brief`
   - `## Product request`, followed by the request paragraph copied verbatim. Preserve every stated word, including quoted phrases; do not paraphrase or silently normalize it.
   - `## Acceptance boundary`, explicitly stating that only HTTPS URLs are inside the acceptance boundary.
   - `## Unknowns`, stating that storage location, retention period, and import support are each `unknown`.
4. Do not add users, features, commands, storage choices, retention choices, import behavior, or any other scope that the request does not state. An undecided detail remains `unknown`.
5. Create `pilot/brief.md` only with an operation that fails when the path already exists. If exclusive creation is unavailable, or if another writer creates the file first, stop without writing or replacing it.

Done means one previously absent brief was created, the request wording is intact, the HTTPS-only boundary is explicit, and every named undecided detail remains unknown. Report a pre-existing brief, missing input, or exclusive-create conflict as no-write rather than trying to repair or merge the file.
