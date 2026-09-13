# Canonical State Predicates

This document defines only the task-card disk predicates shared by split, work, verify, and resume.
Each stage owns its procedure and does not redefine these predicates.

## Task-card predicates

The canonical `Depends` value is `none` or task-card numbers joined by `, `. Only a card
missing either `Approval` or `Review` is a legacy card. On a legacy card, a whole value
that is blank, `—`, or `none` means no dependency. Otherwise split it on literal `, ` and
read only the task-card number at the start of each member. A task-card number matches
`[0-9]+[a-z]*(?:\.[0-9]+[a-z]*)+`. Trailing prose takes no part in lookup. A noncanonical value on a current-
format card, a legacy member with no leading number, or a number that does not resolve to
exactly one tree card is an integrity anomaly. Never infer the replacement.

Approval is effective only when the card value is
`YYYY-MM-DDTHH:MM:SSZ; parallel: <number+number|none>` and the following disk condition
also holds. The card exists at the same repository-relative path in the integration tip
the canonical rules define. Calling that authority `<authority>`, that path appears in
neither of two lists computed once for the whole tree: `git diff --name-only -z
--no-renames -- devflow/tree` and `git diff --cached --name-only -z --no-renames
<authority> -- devflow/tree`. Split that output on NUL, never on newlines, and never drop
`--no-renames` — it is what makes a moved card appear under both its old and its new path.
These comparisons judge the index, working tree, and authority through Git-normalized
content. The `parallel:` value records the card numbers the plan judged safe to run
together — it neither permits nor blocks a claim; work reads it as information when
naming same-unit claims.

A pending task card is ready only when Approval is effective and one of two conditions
holds: `Depends` is `none`; or every parsed dependency number has exactly one `.done.` task card. It is not ready
otherwise. An unparseable member or zero or multiple matches is the integrity anomaly
above, not merely not-ready.
