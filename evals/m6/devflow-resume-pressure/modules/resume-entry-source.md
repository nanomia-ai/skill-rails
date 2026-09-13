---
name: resume
description: Resume and domain entry. Restores a new session from disk and continues to the next stage, or finds a capability document by number or name and explains the domain. Use for session restarts, continuing work, status checks, or capability and domain onboarding questions.
---

# resume — Resume

First read the canonical rules (`../principles/SKILL.md`), canonical state predicates
(`../principles/state-predicates.md`), canonical verification predicates
(`../principles/verification-predicates.md`), and canonical capability knowledge baseline
predicates (`../principles/baseline-predicates.md`).

Purpose: a new session restores state from the bounded reads below when the tree exists; without a
tree, it derives the next stage from the Layer 0 documents and continues.

## Domain-Entry Questions

When the user's request is to explain or enter a capability or domain rather than resume
state, run this section before normal routing. The selected capability's confirmed reasons
and reproducible observations live inside that capability document — there is no separate
record set to open.

1. If any of product.md, arch.md, or glossary.md is absent or arch.md lacks `Brownfield`,
   report only each exact missing path or field and `domain knowledge not initialized`; open no capability body. When the user asks
   to initialize it, leave this section and use normal resume routing. With all three present,
   read product.md's identity paragraph and capability list, plus the file names and shape
   projection under `devflow/project/capabilities/`. Resolve the target by the canonical
   rules' canonical recognition; the selected unit's number names the same-numbered
   capability document. With an empty resolution set, present only foundation plus
   non-retired number/name candidates and ask; with two or more, present only the resolved
   candidates and ask. Open no body before the answer. When no same-numbered file exists for the selection, including foundation,
   report only the expected path and the repair route — adopt with `Brownfield: yes`, arch
   with `no` — and invent no explanation. Open foundation and every non-retired capability
   file only when the user explicitly requests the full expected set. A general domain
   question is not such a request. When the unique same-numbered file has the canon's exact
   `legacy v0.10` shape, open no body and report only its path and the arch or adopt mechanical
   migration route. Before opening a body, require exactly one same-numbered
   file with valid fixed boundary, sections, and metadata shape. For a single request, a
   duplicate or shape anomaly returns only bounded shape facts and the repair route. The user
   resolves a duplicate number/path anomaly. Zero or multiple boundaries follow the canon's
   recovery procedure; arch or adopt repairs one-boundary design shape, while the next
   capability closure's verify repairs a verified-only shape anomaly. For a
   full-set request, open only valid files, report each anomalous number the same way, and
   continue with the rest.
2. Read the selected file's design and verified zones and the exact paths named by Binding
   ADRs. Run the canonical baseline predicates' Design head, Scope head, and Covered cards
   comparisons. Do not present a hypothesis as current fact. When a Binding ADR path is
   absent, report the exact path, make the design zone a hypothesis, and search for no
   substitute.
3. Answer in this order: path; purpose and boundary; concepts and invariants; verified
   current behavior and entry points; consumed contracts and traps; freshness of both zones;
   and the symmetric difference in completed cards since the baseline. When the evidence is
   `None.`, say so. When the selected capability has a knowledge capsule folder, present the
   header projection from
   `node <plugin root>/scripts/project-knowledge.mjs project --capability <capability number>`
   as an index alongside, and open only the capsules the user picks through the same tool's
   `select --path`, within the opening budget — a request for all of them is that budget's
   explicit approval (`--approved`).

This answer changes no file or state and asks no normal-resume approval question. If the
user then requests implementation, return to the normal procedure, report state, obtain
approval, and let work automatically read the same numbered document.

## Tweak Entry

When every item of the current conversation's request that asks for a repository change
passes the canonical rules' three tweak questions,
do not run the procedure below (state restoration) — this lane consumes no prior record
and changes no shared state, so there is nothing for restoration to protect. Apply only
the canonical open-Git-operation gate, follow the canonical tweak lane, and end — when
that lane's machine checks judge it cannot proceed, return as they direct. When items
requesting no change (a question, a status check) ride along, do not end there — handle
the passing items as tweaks, then run the procedure below to answer them: a status answer
comes only from restored state. A conversation
with no change-requesting item is not this section's subject — a status question belongs
to the normal procedure, a domain question to the domain-entry section. Items
that fail the three questions, or whose verdict flips mid-change, return
to the normal procedure
(the request-recording row receives them, and the recorded line holds only those items).
The passing items are handled in this conversation through the canonical tweak lane — the
recording commit first, the tweak commits after. Those edits' approval is the tweak lane's
declaration (the conversational request is the approval); report-then-approval applies
only to planning the recorded items.

## Procedure — when the tree exists, in exactly this order

```
1. product.md's identity paragraph and capability list; arch.md's Brownfield and
   integration fields; and the file names directly under `devflow/project/capabilities/`
   plus the canonical baseline predicates' shape projection
   (mechanical query results only — never the body)
2. the devflow/tree/ listing at the integration tip; a depth-1 folder carrying `.done`
   uses the canonical closed-folder projection   ← how far things got (.done./.wip./pending)
3. every claim of mine — path and status for all, and in full only the one this
   invocation continues. That one is settled at once when the user named it; otherwise
   the matched row's selection settles it at report time — an evidence row names its card
   itself, and when work's selection takes a ready pending card instead, this invocation
   continues no claim. Until it is settled, skip the full read and the uncommitted
   comparison; once settled, run both for that one. When
   the user named work that is not a claim, this
   invocation continues no claim — the same skip applies. With
   two or more claims of mine and a conversation naming neither a card nor a depth-1
   unit, do not guess and continue the first — another terminal may be carrying that
   card right now. Only
   when the matched row is work and that row does not itself name the card, show the
   claim paths, ask which one to continue, then fully read the chosen claim, run its
   deferred uncommitted comparison, and report —
   a row going elsewhere leaves nothing to ask. For
   others' claims, path and claimant only. From every
   pending card, read only `Depends`, `Approval`, and `Review`. When `git worktree list`
   reports two or more worktrees and this folder holds, for the claim this invocation
   continues, neither an
   uncommitted change to that claimed card's file nor a commit outside integration whose
   subject contains a token
   exactly equal to that card's number, do not guess which folder is running it — show that listing's paths and branches
   and ask whether to continue here or open it in that folder. Ask this only at report
   time, when the matched row is work and this invocation continues that claim — a row
   going elsewhere leaves nothing to ask
4. **Bounded verify projection** — Run a mechanical query that does not put every verify.md
   into model context. For each file, it emits only the four revisions and `Verdict`; the
   maximum source id per section;
   whether an entry lacks a source id; the path, state, source id, and event key of entries
   in `routing prepared`, `routing: pending`, `awaiting user decision`, event `routing`, or
   event `pending`; and whether a record exists for each finite event key currently due
   under the verification predicates. It emits no completed description or finding and no
   event key that is not currently due. Read through the end of only one active or missing-
   source-id entry selected by that output. Until the state table selects the exact file and
   state and calls verify, do not read `Scenario`, `Executed`, `Regression`, `Standards`,
   `Provisional`, or `Journal sweep`
5. my room's HANDOFF.md                            ← the next step
6. devflow/journal.md in full (if present — the sweep discipline keeps it short)
                                                   ← cross-task decisions
7. Full git status. Compare uncommitted changes against the progress log's last entry of
   only the claim this invocation continues, and report every remaining uncommitted path
   without attributing it to a card. For every pending card, check the same path exists in
   the authority; run the state predicates' two tree-wide Git diffs once and judge every
   pending card from them, using the integration tip as authority
```

**Check HANDOFF's freshness before trusting it.** Compare its date against the newest
task commit (`NN.N` message form, wip included — commits bearing my id prefix or
touching my claimed-card paths). Handoff is written only at boundaries,
so a session that died mid-task leaves the previous boundary's file behind — one that
points at a step already taken. If any task commit is newer than the HANDOFF date,
report it as stale and let the tree and my claimed card decide. A header outside
`# HANDOFF · YYYY-MM-DDTHH:MM:SSZ` also counts as stale. **When HANDOFF conflicts with the
tree, the tree wins.**
Include in the report the open journal items a person must decide, and the content of a
legacy `Open decisions` section still sitting in HANDOFF.

## Report, Then Approval

Report what you read in **one paragraph**:

```
"<service> is complete through <capability>, with <task> in progress.
The progress log reaches <last point>; capability documents are
<non-retired filenames|none>. The next step is <one step>, selected by
<your request | the last handoff | canonical order>. Also open:
<every other unit holding a candidate under the same matched row | none>; uncommitted and
unattributed: <those paths | none>; not yet on integration: <N paths | none>. Proceed?"
```

`not yet on integration` is the count of task-card paths under `devflow/tree/` changed by
the commits `integration..HEAD` contains — the current branch's commits the integration
tip lacks — plus a `devflow/journal.md` change, and it is `none` only when that commit set
is empty — journal lines
appended during a blockade show in this count too. The integration tip being an ancestor
of the current branch is no ground for `none`: a branch with local commits piled up is
exactly that shape. In a session the canonical rules judged
unable to
publish to integration, that count keeps growing — that is the signal of working scattered.

The selection reason comes straight out of the canonical candidate order — `your request`
when the step came from a card the user named or from the session unit, `the last handoff`
when it came from the carried unit, and `canonical order` otherwise. When the session unit
holds no candidate, say so in that clause. When the matched row is work, the step reported
is the one work's own selection would take — work's precondition 2 takes a remote-evidence
transition first, and only with none left does canonical candidate order over my claims and
every ready pending card choose — so the report and the stage cannot name different cards.
When a remote-evidence transition was chosen, report that card path and the next action its
branch specifies.
When the conversation named no depth-1 unit and two or more units hold a candidate under
the matched row, ask which unit to continue instead of proposing one. With a single unit
holding candidates there is nothing to ask; propose it.

Exclude retired capability documents from the list. When the next stage names a capability or
foundation, include that numbered document's exact path. Append any shape-projection anomaly
as one line naming the path and zone.

Once approved, continue into the stage named in the report. Never modify code before
approval. The request-recording row's one commit is the exception that precedes the
report — recording is immediate (the table scan lands that line and rescans), and what
approval guards is planning and code, not preservation.

Derive that next stage by scanning this table from top to bottom and taking the first
matching row. The table's journal and verify rows judge from the reads the procedure
already made (step 6's journal, step 4's projection) — which is how lines appended
locally during a blockade stay visible:

| Disk state | Next stage |
|---|---|
| `git status` reports an open rebase or merge | resume — stop normal routing and obtain the user's decision through the canonical open-Git-operation gate |
| Any verify.md in HEAD contains a valid `routing prepared` object | verify — compare and apply its payload, then finish the completed state and specified route commit without committing the prepared object again |
| One or both of journal and verify.md differ from HEAD in the working tree, and the full working-tree diff is a canonical verification-state transition, product-result write prefix, uncommitted route with its output, or prepared-route prefix | verify — without repeating execution, first finish the missing output and that state or routing commit |
| Any verify.md has a legacy Failure history, Audit, or Retrospective entry without a source id | verify — first finish the canonical source-id migration commit |
| A valid layer-opening marker exists in the working tree or HEAD | split — take the earliest marker together with every marker carrying the same `source-json` as one bundle, and finish the interrupted planning commit from its durable source and minted numbers |
| journal contains a `product verification running` line | verify — rerun the recorded flight |
| journal contains a `product verification result` line | verify — finish the stored result's failure routing, events, and report |
| An `evidence-wait` or `evidence-finalizing` journal line names a card of mine | work — take that remote-evidence transition first; report the exact card path work's precondition 2 selects and the next action of that branch |
| The canonical claim→done move is uncommitted, or the last commit changing one of my claimed cards has the canonical final task subject | work — make no second final task commit; finish only upper-document feedback and the boundary |
| An Audit or Retrospective section has a `routing · source id:` state | verify — land pending-finding routing one at a time in finding-number order |
| An Audit or Retrospective section contains findings `awaiting user decision` | verify — present the recorded findings verbatim and record the decision |
| Any verify.md Failure history has `routing: pending` | verify — without executing, route one entry: first verify.md in canonical path order, then lowest source id in that file |
| journal contains an exact `product re-run pending` line | product |
| A valid capability-closing marker exists in HEAD | verify — finish the interrupted capability closure |
| journal contains an exact `re-split pending` line | split — finish the replacement-card plan for the earliest marker |
| arch.md lacks the Brownfield field | ask once, "Did implementation code exist before devflow entered?"; yes makes adopt add only the field, no makes arch add only the field |
| arch.md lacks the `integration` or `merge` line | arch — propose under arch's integration default rule (branching on worktree count), confirm it, and add only those two lines |
| A bare `.wip.` card or a root `devflow/HANDOFF.md` exists | work — confirm the owner with the user, then finish the room-upgrade rename and HANDOFF move in one commit |
| `devflow/project/glossary.md` is missing | with `Brownfield: yes`, adopt reverse-derives only glossary.md; with `no`, product creates only glossary.md without changing the confirmed product.md |
| A task card has a `Depends` member that the state predicates cannot parse, or a dependency number does not point to exactly one card | split — replace it with the user-confirmed canonical dependency value and finish the planning commit |
| My claimed card lacks `Approval` or `Review`, has `Approval: pending`, or has noncanonical `Depends` | split — checkpoint any current diff and progress log, release the card, normalize legacy dependencies, finish execution-proposal approval and the planning commit, then reclaim it |
| My claimed card has a `Depends` target that is not `.done.` | split — release the original card and finish the prerequisite |
| The current conversation carries a change request from the user that no journal line or verify entry preserves yet, that canonical recognition does not resolve to an existing card — pending or claimed — and that is not an item the tweak lane already handled in this conversation (its commit is that item's preservation) | split — record the request as the canonical journal line in one commit, read no code, plan nothing, then rescan this table |
| A card of mine is claimed | work |
| An expected file has the canonical baseline predicates' exact `legacy v0.10` shape | with `Brownfield: yes`, adopt; with `no`, arch — migrate to current Layer 0 design plus the mechanically carried verified zone |
| An expected file under the canonical baseline predicates is missing from HEAD, or an expected HEAD file with exactly one fixed boundary has a design section, design metadata, or current Design head that differs from the contract | with `Brownfield: yes`, adopt; with `no`, arch — refresh only the expected set's design zones without rebuilding Layer 0 |
| journal contains an exact `maintenance routing pending` line | split — plan the earliest line's request through maintenance routing |
| An expected HEAD file has zero or more than one `## Verified state` boundary | resume — instead of the whole original, report its path, the HEAD boundary count that selected this route, the working-tree boundary count and line count, the HEAD blob object ID for that exact path or `none`, and the expected boundary, then offer only two choices: (1) after confirming that a user-identified Git revision and path has one boundary, the user restores those bytes to the damaged file's current expected path and commits only that file; (2) state the discarded verified prose and HEAD blob ID, obtain confirmation, and route `Brownfield: yes` to adopt or `no` to arch for a whole reset from current Layer 0 plus an empty verified scaffold under the ordinary design-batch confirmation. Search no history for a known-good revision; resume writes no file, and deferral changes no file |
| journal contains an exact `product verification requested` line | verify — product layer |
| A Retrospective section has a `pending · source id:` state, or an Audit `pending · source id:` state passes the Audit execution boundary | verify — run and record one runnable pending event |
| Under the verification predicates, an automatic Retrospective is unrun; an automatic Audit is unrun and passes the Audit boundary; a user-request Retrospective has its target record; or a user-request Audit has its target record and passes the Audit boundary | verify — run and record one new event |
| A foundation, capability, or intermediate folder that is neither `.done` nor `.stale` is empty | split — finish opening one layer of that folder |
| A non-capability folder has at least one direct child that is not `.stale.`, every such child has a `.done` status, but the folder is not `.done` | resume — add `.done` from the deepest matching folder upward and finish the interrupted boundary |
| A depth-1 capability folder that is neither `.done` nor `.stale` has at least one direct child that is not `.stale.`, and every such child has a `.done` status | verify — capability layer |
| `Brownfield: no` and a non-retired product.md capability has neither a matching depth-1 folder nor waiting file, or a retired capability has neither a matching `.stale` folder nor `.stale.md` waiting file | split — restore product.md-to-tree correspondence |
| `Brownfield: no` and the tree root has neither `01-foundation/` nor `01-foundation.done/` | split — create `01-foundation/` and at least one direct task card in the same layer |
| A pending task card lacks `Approval` or `Review`, or its `Depends` is not canonical | split — normalize legacy `Depends` under the state predicates, ask the user about any unparseable member, add missing fields as `pending` and `required` except a research card's Review is `not-applicable`, then present the execution proposal |
| A pending task card's `Approval` is not `pending` and is not effective under the state predicates | split — report the exact invalidity, reset `Approval` to `pending`, reapprove the execution proposal, and finish the planning commit |
| A pending task card's `Approval` is `pending`. Exclude it from this row when it is an implementation card with both `Coordinates` and `Identity` and its `Depends` includes a research card that is not `.done.` and has neither field | split — present the execution proposal and get approval |
| A pending task card is ready under the state predicates | work |
| A waiting capability file exists | split — open one layer of that capability |
| No earlier executable row matches, and at least one pending Audit, user-request Audit with a target record, or due automatic Audit fails only the Audit execution boundary | verify — run no event and write no state; list those candidates in event-priority order and report each exact blocking path or branch state and reason |
| Pending task cards remain, but every effectively approved card has at least one `Depends` target that is not `.done.` | report the blocking card numbers and claimants; modify no code until a dependency closes |
| No earlier row matches and the only unfinished work consists of others' claims | report the claimants and cards; wait until a claim is released or closes |

The `awaiting user decision` findings row does not block a pass, `.done`, or other work.
Record a decision when the user makes it now. If the user defers or asks to continue
without deciding, keep the text unchanged and treat only that row as nonmatching for the
rest of this session's table scans.

The blocked-Audit reporting row does not gate a verdict, `.done`, product-result reporting,
or other work. After reporting the current candidates, leave disk unchanged and treat only
those candidates as nonmatching event rows and as not unrun events for the rest of this
session's table scans. Judge them again next session because the execution boundary can change.

Report a file whose verified-zone sections or verification metadata alone have malformed
shape, but open no separate stage. The next capability closure's verify run replaces that
zone in full and heals it. If the user defers baseline repair, skip only the three baseline
rows (exact `legacy v0.10`; a missing expected file or a design-shape mismatch; zero or
more than one boundary) during the rest of this session's table scans; do not block the
execution axis. split's maintenance-mapping gate does not open on that deferral — a card
mapped from a stale boundary lands in the wrong capability.

When no earlier row matches and `Brownfield: yes`, report the tracked post-adoption work
complete and wait for a new request. Run the product layer only when the user explicitly
requested it and journal has an active product-verification state.

Check the next four rows only with `Brownfield: no`, no earlier match, an absent or
`.done` foundation, a `.done` folder for every non-retired product.md capability, a
`.stale` folder or `.stale.md` waiting file for every retired capability, and no pending,
claimed card or waiting capability file. `Brownfield: yes` entered through an active
product-verification state uses the same four rows without the complete
capability-representation requirement.

| Disk state | Next stage |
|---|---|
| Root verify.md is missing; any of its `Product revision`, `Verification revision`, or `Code revision` differs from the verification predicates' current value; a path outside devflow is uncommitted; or it has no verdict | verify — product layer |
| The product-layer verdict for the current Product revision, Verification revision, and Code revision is fail | verify — finish routing the recorded failure, or rerun the product layer once all fix cards are closed |
| The product-layer verdict for the current Product revision, Verification revision, and Code revision is unverified | verify — rerun the product layer |
| The product-layer verdict for the current Product revision, Verification revision, and Code revision is pass, with no unrun event | report completion and the count of findings awaiting user decision, then wait for a new request |

For the non-capability-folder boundary row above, after approval modify no code: rename matching
folders from deepest to shallowest, make one boundary commit, then rescan the table from
the top.

## Digest — catching up on work outside my sessions

Digest happens only at a clean boundary — after a card closes, or right before a new
claim. An in-progress claim is never interrupted to digest.

```
1. Pull the integration branch (arch config)
2. From commits after my room's digest.md marker, pick the digest targets:
   everything not authored by me + anything authored by me without my `<my id>` prefix
3. For each target commit, read its subject and changed paths. Read the diff only when it
   touches a shared document, the capability folder of the next claim candidate, or a
   `Read first` path on that candidate card. A commit whose subject has the canonical tweak form (`tweak ` after the id prefix)
   touches no `devflow/` path by its own form, so the shared-document judgment ends at
   subject and paths — when it touches the candidate's capability folder or a `Read first`
   path, read its diff like any other commit. A
   contradiction with a shared document lands
   through the discovery→update table. Fixing a shared document is a binding decision
   (the canonical rules' commit discipline)
4. With a backlog over 30 commits, open no individual diff. Read a `git log --stat` rollup
   by path and capability. If that still cannot select the step-3 diff targets, ask the
   user to confirm the commit for the digest marker and record the exact skipped commit
   range in journal
5. Advance the marker; it rides the next boundary commit — for a just-before-claim
   digest, it rides that claim commit (work's claim-commit rule)
```

If the marker is unresolvable (force-push, etc.), report it and re-anchor with user
confirmation — default candidate: my last commit. Silent full re-digestion is forbidden.
A marker merge conflict (my two machines): keep the descendant hash; if unrelated, run
the re-anchor procedure.

## Exceptions

- No claim of mine: derive the next stage from the table above.
  Include a one-line summary of others' claims (who holds what) in the report.
- HANDOFF missing or empty: normal. Resume from the tree alone.
- No tree at all: read the Layer 0 file list and all of journal when it exists, first run
  every applicable canonical integrity check, derive the next stage in this order, report
  it in one paragraph, and get approval.
  1. No `devflow/project/product.md`: ask, "Must this work preserve implementation behavior
     that already exists in the repository?" Yes goes to adopt; no goes to product.
  2. If journal has an exact `product re-run pending` line, run product.
  3. product.md exists but glossary.md does not: ask the same question. Yes makes adopt
     reverse-derive every missing Layer 0 document; no makes product create only
     glossary.md without changing product.md.
  4. product.md exists but arch.md or code-style.md does not: ask the same question. Yes
     makes adopt reverse-derive only the missing documents; no runs arch.
  5. product.md, arch.md, code-style.md, and glossary.md all exist but arch.md lacks Brownfield: ask,
     "Did implementation code exist before devflow entered?" Yes makes adopt write only
     `Brownfield: yes`; no makes arch write only `Brownfield: no`.
  6. If Layer 0 is complete and an expected file has the canonical baseline predicates'
     exact `legacy v0.10` shape, adopt with `Brownfield: yes`, or arch with `no`, runs its
     mechanical migration. Otherwise, when an expected file is missing, or an expected file
     with exactly one fixed boundary has a design section, design metadata, or current Design
     head that differs from the contract, the same branch creates or refreshes only the
     capability documents. Any other fixed-boundary anomaly follows the user-confirmation
     route above.
  7. If a valid layer-opening marker exists in the working tree or HEAD, split selects the
     earliest one and finishes its planning commit from the durable source and minted
     numbers.
  8. If journal has an exact `re-split pending` line, run split.
  9. If journal has an exact `maintenance routing pending` line, run split's maintenance routing.
  10. If journal has an exact `product verification requested` line, run verify's product
     layer.
  11. With `Brownfield: yes`, use split's maintenance routing only when the current
     conversation contains a post-adoption change request. With no request, report
     adoption complete and no active work, then wait.
  12. With `Brownfield: no`, run split. Run design only when the user explicitly selects it.
