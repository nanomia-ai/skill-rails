---
name: principles
description: devflow canonical rules. Every devflow skill follows this document first — the 7 prompt principles, model tiers, failure ladder, status notation, commit discipline, and the verification iron rule.
---

# devflow Principles (Canonical Rules)

Every devflow skill, card, and prompt follows this document. When any other document
conflicts with it, this document wins.

## The 7 Prompt Principles

1. **One concept, one word.** No synonyms. Register project-specific terms in
   `devflow/project/glossary.md` and use the same word everywhere, to the end.
2. **Destination over instruction.** Write "what must become true," not "what to do."
3. **Rich direction, short prohibitions.** Give context, intent, and the "why" generously.
   Keep the harness (prohibitions) to 3 lines or fewer.
4. **Never prescribe the method.** The executing model decides how to implement.
5. **One example beats five rules.**
6. **Avoid off-the-shelf methodology terms.** Words like spec-driven, TDD, DDD drag in
   baggage you did not choose.
7. **Repeat the identity.** Copy the identity paragraph from `product.md` verbatim into
   every task card (exception: research cards — split's research card section).
   This is the only duplication allowed — it costs one paragraph and
   buys "never getting lost."

## Identity and Rooms

devflow has one mode. Whether one person or several share the repository, every session
works out of its own room.

Resolve your id before writing to the tree, journal, or a core document
(`devflow/project/*`), and before landing a tweak commit — read `git config user.name` and `git config user.email` and match
each non-empty value against the `git:` line of each `devflow/users/*/owner.md`. An empty
value matches nothing, and a value that matches a room's `git:` line while the other
value conflicts with that same line is not a match. Exactly one match is your room. With no room on
disk, propose an id derived from that identity, or ask for one when both values are empty,
and create the room through the joining transition below. With rooms on disk and no match,
show every existing id and ask whether this is a new person or a changed identity: a new
person joins through that same transition, while a changed identity replaces the `git:`
line of the room the user names and creates no room. Whichever skill first writes to the
tree, journal, or a core document does this. A session that cannot resolve an identity, or
cannot put the question to a user (CI, bots), only reads.
ids are lowercase `[a-z0-9]{2,8}`. Names devflow uses (project, tree, users, decisions)
are forbidden; ids are never reused.

Room = `devflow/users/<id>/` = owner.md + HANDOFF.md + digest.md. owner.md is two lines,
`id: <id>` and `git: <git user.name>, <git user.email>`. digest.md is one line holding the
digest marker, a commit hash or `none`. Write only in your own room. Rooms are readable by
the whole team — write with that premise.

devflow runs only in a Git work tree — claims, approval freshness, integration, and every
undo live in Git. The first skill to run in a folder that is not one proposes `git init`
and stops when the user declines. With `user.name` or `user.email` unset, propose the exact
`git config` line and stop until it is confirmed; Git itself refuses to commit without
them. Every devflow path is relative to the repository root — resolve the root at entry
with `git rev-parse --show-toplevel`. A cwd inside a subfolder never grows a second
devflow there.

**Only `.wip-<my id>.` is my work.** The precondition, full-read, and continuation
rules apply to my claim only. Another's claimed card is read-only reference — never write
a card you have not claimed.
Reassigning a stalled claim = release, then re-claim. Only on the user's explicit
instruction, with 1 journal line (the sanctioned exception to claim inviolability).

**The integration branch.** arch.md's `integration` names the branch where minting,
closure, and binding decisions land. When it names the current branch, or
arch.md is absent, or it carries no `integration` line, **the integration tip is HEAD**, and every
devflow rule that fetches, integrates, pushes, or compares against integration reads the
current branch and runs no network command. When it names another branch, read that
branch's tip, and fetch or push only when that branch tracks a remote — a purely local
integration branch needs no network command. In every ancestor test here, a commit is its
own ancestor.

**Shared truth is the integration branch.** Card status, tree numbers, verify source ids,
`devflow/journal.md`, capability documents, and binding decisions are judged at the
integration tip. Your own working tree and HEAD hold a transition still in progress, and the
rules below name exactly when to read them. Every worktree of this repository shares one
`.git`, so a commit made in one is visible from another with no fetch and no remote — but
another worktree's HEAD is evidence not yet integrated, never authority: that flow's code
and progress log arrive when it integrates, and no shared-state judgment reads it.
`git worktree list --porcelain` lists this repository's worktrees, and `git worktree prune`
drops one whose folder is gone.

**Publishing a shared transition.** Publishing is the act of landing a transition on
integration, and landing is its result — the two words name one motion. Before
publishing, remember the integration tip's
unabbreviated full commit object ID output by Git. When publishing is rejected, read
integration again; a changed id means the state you judged from is stale, so judge again
from the latest. Classify the rejection by one mechanical test, never by error text, which
varies by locale and Git version. When the integration tip is not an ancestor of the branch
you tried to publish, this is ordinary contention: integrate that tip and retry — three
times at most. When the tip is an ancestor and the publish is still refused, it is a
structural blocker: report the exact cause. After three tries that still find the tip ahead,
report sustained contention; it is not a failure-ladder count. When someone else landed a
claim on the same card first, do not retry — follow the lost-claim rule below. When the
same number was minted for two different cards, that is not claim contention — the minting
rule's mid-insertion (`03.2b`) below handles it. When you cannot publish to integration at
all — another worktree holds it, or permission, protection, or the network blocks it —
these continue: code edits, progress-log checkpoints, tweak commits (the lane's commit is
not a binding decision), and the final task commit (it
belongs to the session's own branch) of a card whose initial claim has already landed on
integration, plus journal appends that mint no number and make no claim — `maintenance
routing pending`, `capability note`, attributed open-item and decision lines, `product
re-run pending` — and their local commits. These wait until integration opens: a new
claim, a new tree number, a new verify source id, a card's `.done.` rename and its
boundary commit, a layer-opening marker (it mints numbers), new `evidence-wait` and `evidence-finalizing`
journal lines (their record commit needs a push), `audit requested` and `retrospective requested` lines,
verification-state lines, consuming (deleting) a canonical journal line, and any
Layer 0 or capability-document change. One exception: when an already-published
`evidence-wait` line passes during the blockade, the final task commit's replacement of
that line with `evidence-finalizing` is not a consumption but a state swap inside that
commit, and it continues on the session's own branch. Report the
exact cause and how to open it the first time it blocks; after that, name in one line each
transition now waiting. The cause is not repeated, and nothing waits unnamed — resume's
report carries the standing count.

**Several hands in one working folder.** Several sessions may carry different cards at the
same time. Change `devflow/journal.md` by appending — reading it and rewriting it whole
drops the lines another session appended meanwhile. Keep in HANDOFF only values the tree
recomputes: an open decision that needs a person lands as one attributed journal line —
its resolution follows the discovery→update table's open-item row. While another flow is alive, edit the part that changes instead of
rewriting a file whole — whole rewriting is the only edit that silently overwrites another
flow's change. When a completion signal or build fails while this working tree holds
uncommitted paths outside my card's own, report those exact paths before counting the
failure ladder. A worktree is not a safety device; it is the
choice for isolating a build completely.

Before routing, fetch integration and read this shared state at that tip: `devflow/project/`,
`devflow/tree/`, `devflow/journal.md`, and resume's bounded verify projection.
When the integration tip is not an ancestor of the current branch and, at
that tip, journal or any verify.md contains an active marker, an active request or
product-verification line, or an event `pending` or `routing` state, include the integration
tip in the current branch before local claimed work. Checkpoint unrelated uncommitted
changes first. This is state synchronization
and runs even while a card is claimed. Digest diff reading and marker advancement remain
clean-boundary-only.

Apply the following gate (the **open-Git-operation gate**) only when
`git rev-parse --is-inside-work-tree` returns `true`. Otherwise skip the gate and do not initialize Git. Immediately on entry before normal
routing, execution, or any path change, and immediately after an integration rebase or merge
command, product, arch, design, adopt, split, work, verify, and resume check whether `git status` reports an open rebase or merge.
When either is open, stop normal routing and report
the operation kind, current branch or detached HEAD, and every unmerged path. Before the
user decides, change no path and make no commit; even with no unmerged path, ask whether
to continue or abort the existing Git operation. Never abort automatically. To continue,
first present and get confirmation for the exact resolution of each conflict that requires
a semantic choice. Allow only those confirmed conflict-resolution paths and commits Git
makes while continuing the existing operation; write no separate devflow state. After the
open operation disappears, read `git status` again and restart the integrity check at item 1.

Room transitions — joining and departure are each one commit; the upgrade splits three ways:

- Joining: create the room — owner.md, an empty HANDOFF.md, and digest.md holding the marker
  = current HEAD — and land only those three paths as `<id> room — join`. It is a binding
  decision. In a repository with no commit yet, the marker is `none` and the first digest
  starts at the repository's first commit. Past understanding comes
  from the shared documents, not from commit archaeology.
- Upgrading from a version without rooms: arch adds `integration` and `merge` to arch.md, the identity resolution above creates
  the room, and work renames its own bare `.wip.` to `.wip-<id>.` and moves
  `devflow/HANDOFF.md` into the room. In that same commit, replace with the new path the
  `card-json` of every `evidence-wait` or `evidence-finalizing` line naming the exact path
  that rename changed, preserving its timestamp, checkpoint, and `check-json` byte for
  byte. A bare `.wip.` or a root `devflow/HANDOFF.md` means
  the upgrade is incomplete — report, confirm the owner with the user, and finish it.
  Never guess.
- Departure: the user declares it. Any remaining member — move any legacy `Open decisions`
  section left in the departed room's HANDOFF into attributed journal lines, release their
  claims, delete the room, 1 journal line. This is the sanctioned exception to both "write
  only in your own room" and claim inviolability.

## Document Hierarchy (the contract)

Whenever a canonical procedure says to write or append a journal line, create
`devflow/journal.md` first when it is absent.

### Exact journal formats

The formats below are the sole canon for reserved journal records. Other skills fill in
their values; they do not redefine the formats. Outside the reserved formats, journal
admits only cross-task decisions and open items a person must decide, and such a line
must start with the canonical timestamp and carry one token exactly equal to an existing
room's id (a substring is not a match) — those two
checks are what "attributed" means. `source-json` contains the whole of one
locator below as a JSON string. Paths are repository-relative, hashes are unabbreviated full
commit object IDs output by Git, and headings are verbatim document headings. A verify `source id` is a
positive integer within that verify.md section; each new entry takes the previous maximum
plus one and an id is never reused. Before first writing a legacy Failure history, Audit,
or Retrospective entry without a source id, assign every missing id in that section in file
order starting after the existing maximum, preserve its original timestamp and content,
and first land `boundary — verify source ids`.

Canonical ordering has only two orders. **Canonical path order** compares repository paths by
the UTF-8 bytes of their repository-relative `/` path strings. **Canonical card-number order** splits on `.`, comparing each component's leading digits
as an integer, put no suffix before a suffix at the same integer, and compare lowercase-letter
suffixes by ASCII bytes. When all shared components are equal, the number with fewer
components comes first; break any remaining tie by the full number's UTF-8 bytes.

**Canonical candidate order** is a selection order among candidates, not a comparison order
for paths or card numbers.

A candidate's **depth-1 unit** is the first path component below `devflow/tree/`, or the
number on an unopened capability's waiting file.

The **session unit** is the depth-1 unit the user named in the current conversation. The
**carried unit** is the depth-1 unit whose number leads the path in `## Next single step`
of my room's HANDOFF, when such a unit exists.

**Canonical recognition** resolves the current conversation's text to a set of units. A
complete product.md capability name, a standalone number token compared with unit numbers
as integers, and text identifying foundation or a standalone `01` each resolve to that
depth-1 unit. A standalone task-card number resolving to exactly one card resolves to that card and
its unit. A resolution set with exactly one member selects it. For candidate ordering, a
larger set selects the member the conversation mentioned last; every other consumer takes
a larger set as selecting nothing.

Order: the card the user named; then candidates in the session unit; then candidates in the
carried unit; then the rest. Within a depth-1 unit and among the rest, canonical
card-number order.

Where a matched routing row can be satisfied by more than one unit and the row names no
selection order, take candidates in this order. It never changes which row matches and
never makes an unready card ready. Freshness governs trust in HANDOFF's statements; the carried unit is only an
ordering key and is used even when HANDOFF is stale.

- `core:<path>#<heading>` — the exact section in that core document
- `card:<path>@<hash>` — the exact task card at that commit
- `journal:<whole reserved journal line>` — the canonical on-disk line, including timestamp
- `verify:<path>#Failure history@<source id>` — the Failure history entry carrying that id
- `verify:<path>#<Audit|Retrospective>@<source id>/<finding number>` — that adopted finding
  inside the event carrying that id

A conversation request first becomes a `journal:` source through `maintenance routing pending`.
Resolve every locator to its exact working-tree source. When a valid `routing prepared`
object replaced the referenced verify source's `routing: pending`, resolve the locator with
the same source id and finding number in that object's `base` commit. For any other
uncommitted output transition that changed or deleted the source so the exact value is
absent, resolve the exact source from HEAD. This includes deleting a journal source with its
layer-opening marker and changing a verify source to its final result. Folder-path
placeholders have the `.done` and `.stale` status suffix removed from every path
component. Only a layer-opening marker's `parent` may have zero matching actual folders
before creation; it must have exactly one afterward. Every other folder placeholder must
always match exactly one actual folder. Two or more matches are an integrity anomaly in
either case.

```text
YYYY-MM-DDTHH:MM:SSZ layer opening: parent: <devflow/tree or folder path with status suffixes removed>; children: <number+number>; source-json: <JSON string containing the exact durable source locator>
YYYY-MM-DDTHH:MM:SSZ re-split pending: folder: <direct parent folder path with status suffixes removed>; stale: <number+number>; source: <devflow/project file path>#<heading>
YYYY-MM-DDTHH:MM:SSZ maintenance routing pending: request-json: <JSON string containing the whole user request>
YYYY-MM-DDTHH:MM:SSZ product re-run pending: statement-json: <JSON string containing the whole disproved identity or success-criterion text>
YYYY-MM-DDTHH:MM:SSZ product verification requested
YYYY-MM-DDTHH:MM:SSZ product verification running: trigger: requested | automatic; product: <Product revision>; verification: <Verification revision>; code: <Code revision>
YYYY-MM-DDTHH:MM:SSZ product verification result: trigger: requested | automatic; product: <Product revision>; verification: <Verification revision>; code: <Code revision>; verdict: pass | fail | unverified
YYYY-MM-DDTHH:MM:SSZ capability closing: folder: <devflow/tree/capability folder path with status suffixes removed>; head: <git rev-parse HEAD>; product: <Product revision>; verification: <Verification revision>; capability: <Capability revision>
YYYY-MM-DDTHH:MM:SSZ capability note: capability: <NN>; note-json: <JSON string containing the whole observation>
YYYY-MM-DDTHH:MM:SSZ audit requested: <capability number|product>
YYYY-MM-DDTHH:MM:SSZ retrospective requested: <capability number|product>
YYYY-MM-DDTHH:MM:SSZ evidence-wait: card-json: <JSON string containing the full task-card path>; checkpoint: <NN.N wip: evidence-wait commit hash>; check-json: <JSON string containing the exact remote-result command or URL>
YYYY-MM-DDTHH:MM:SSZ evidence-finalizing: card-json: <JSON string containing the full task-card path>; checkpoint: <NN.N wip: evidence-wait commit hash>; check-json: <JSON string containing the exact remote-result command or URL>
```

Before creating a layer's first child or folder, land its layer-opening record together
with any uncommitted source record in a `split — begin <parent>` commit. When one source
spans several depth-1 units, write one layer-opening marker per affected parent, all
carrying the same `source-json` value and landing in one begin commit — that locator is the
bundle's identity, so no separate bundle identifier is created. `<parent>` is then those
parent paths joined with `+` in canonical path order. Land a capability-
closing record together with the passing verify.md record and, when the canonical baseline
predicates' verified-zone refresh succeeds, the closing capability's baseline file, in a
`boundary — begin <capability number>` commit before the folder rename or any other journal
change. The canonical baseline predicates govern a refresh no-op. Both remain active until the
next commit deletes them. If the working tree lacks one but HEAD contains it and its deletion
is uncommitted, a consumer treats it as active and finishes the interrupted commit first.
These begin commits are not task commits.

`product ⊃ arch ⊃ design·code-style ⊃ tree (cards)`. **A lower layer may not violate an
upper layer.** If it must, that is an upper-layer decision:

1. Stop. Write 2 lines of "why" in the progress log.
2. Fix the upper document (add an ADR if the three ADR conditions hold — see arch).
3. Mark cards that need replacement work `.stale.`. For each direct parent folder of
   those cards, write one canonical `re-split pending` marker in journal.md. Delete in
   the same binding-decision commit every `evidence-wait` or `evidence-finalizing` line
   whose card path names one of those cards.
4. Re-split the affected range, then resume.

`stale` is the numbers of direct-child task cards made `.stale.` by this decision, in
canonical card-number order and joined with `+`. First land the upper-document edit, `.stale.` renames, and
markers in one binding-decision commit. Capability retirement follows product's `.stale`
folder and `.stale.md` rules and creates neither replacement work nor this marker. Delete
in the retirement commit every `evidence-wait` and `evidence-finalizing` journal line
that names a card inside the retired open folder. Before confirming a retirement, run the **retirement observation gate**: within
the current journal already read in full, enumerate every `capability note`
line carrying that capability's number — that observation's only consumer is that
capability's next closure, and a retired capability has none, so the line would stay
forever. Zero lines retire as they are. With one or more, put the user's chosen discard, or
reassignment to foundation or an exact non-retired capability number, in the same
retirement commit; when the user defers, the retirement defers too. product editing those
lines is the sanctioned exception to journal ownership, and automatic discard is forbidden.
split deletes the marker when the replacement cards' planning commit lands.

`Needs replacement work` has one test. It is needed when the changed upper-document
statement cannot be true together with the card's Destination, Forbidden, Completion
signal, or the implementation produced by that card; it is not needed when all can be true
together. If they cannot all be assumed true while card text and implementation stay
unchanged, rename the card `.stale.`.

**A contradiction between documents is a defect, not a precedence question.** Silently
adopt neither side — stop, reconcile through this procedure, then proceed. A delegated
implementer stops and reports only; reconciling is the main session's job.

A document states only the present. When the same concept is updated, overwrite the place
that concept lives — the concept, not the file. Then whoever reads next takes what they
read as current, with no version to choose between.

What can be overwritten is what can be recomputed. Execution results, observations, and a
person's confirmation are not recomputed, so land them where that fact lives in that
document before overwriting — the place differs by document, and the table just below names
which one. The number, the execution conditions under which that number is true, and the
command that measures it again go in one block — together they let the next person settle
it by measuring again.

One sentence separates an update from a drop — would someone reading the old statement now
take a wrong action? Then keep it as a dropped direction. Otherwise overwrite that place.

A dropped direction is a present fact, not a past one, and it lives beside the conclusion
it lost to — what was dropped, why, and what reopens it. Only the reading condition
differs: open it when you are about to reverse that conclusion.

At brownfield adoption, write anew only what was confirmed in code. The remaining old
documents stay in place as sources, and their disposition belongs to a person alone.

Past versions are git's to carry. Name the overwritten concept in the subject of the commit
that overwrote it — that is git's index, and it is what lets ordinary reading end at the
current document.

What you discovered → where to update:

| Discovery | Update target |
|---|---|
| Feature, screen, or scope changed | product.md (+ mark affected cards that need replacement work `.stale.` + the `re-split pending` markers above) |
| A capability's name changed | first update product.md's capability row + the same-numbered tree folder or waiting file (a waiting file's body line takes the new name too) + every arch.md `Existing records` line naming it in one binding decision (+ replace any path inside that folder named by HANDOFF). The following arch capability-design commit, or adopt in a brownfield, updates the same-numbered baseline path and design zone together. The baseline predicates own recovery between the two commits. Code paths and arch.md's Code structure keep naming what exists on disk, and that sketch entry still maps to this capability; moving code is a separate card. The number never changes and no card moves. Land the first commit only while no canonical journal marker or `evidence-wait`/`evidence-finalizing` line names that folder or a path inside it |
| A capability turns out to be two | product.md — narrow the existing row and append the new capability — and arch.md's Code structure for the path split. The existing folder keeps its number, cards, and history; the new capability gets no folder or card now. No card is backfilled or moved. arch, or adopt in a brownfield, re-derives affected design zones and the new capability document and reports the canonical registered-consumer projection. When narrowing also changes the existing capability's name, use the rename row above too |
| Stack, module boundary, or data shape doesn't fit | arch.md (+ consider an ADR) |
| A value the upper document called provisional is now measured | that row of arch.md's Provisional table — **replace it, don't add beside it**. An ADR that assumed the old value gets a dated update note |
| A Provisional row's settling card is 'unminted' and the tree has reached its layer | create the settling card and replace 'unminted' in that arch.md row with its number |
| A design build result confirms or disproves design.md's source, token, component, or review-surface reference | If it remains true with the approved direction, replace only the exact one-line path, name, or command. If the direction of the Approach, Design source authority, Token strategy, Component strategy, Decomposition axis, or Review surface changes, first record it in a canonical `maintenance routing pending` line and re-run design through split 2a. After confirmation, split applies `.stale.` and the `re-split pending` marker above to affected cards that need replacement work |
| A success criterion turns out unrunnable as written | product.md (+ the cards that quote it) |
| A measurement disproves the content of the confirmed identity paragraph or a success criterion (not unrunnable as written — running it as written gives a wrong signal) | After user confirmation — if the replacement statement is settled, replace just that statement; if what replaces it is a planning question again, re-run product with the line below (and arch if the change reaches it). In either case, affected cards that need replacement work receive `.stale.` and the `re-split pending` markers above. The next session may take up the re-run on the strength of its line |
| The user changes a confirmed statement themselves, with no disproving measurement | That conversation IS the confirmation. If the replacement statement is settled, replace just that statement; if what replaces it is a planning question again, re-run product with the line above. Affected cards that need replacement work receive `.stale.` and the `re-split pending` markers above. When a related decision is recorded, overwrite it in place; `owner decision` is a sufficient one-line ground |
| A `.done.` card's completion signal turns out unrunnable | fix that card's signal text too — regression must stay runnable |
| A new coding-convention decision is needed | one line in code-style.md "Project choices" |
| A verification means is newly created or changed | the means line of arch.md's verify_channel |
| A file in arch.md's `Existing records` moved or no longer matches current code | replace or delete that exact path (+ `Read first` in pending or claimed cards carrying it) |
| A decision recorded in an ADR is reversed or no longer applies | overwrite that ADR in place with the decision that now holds, and add one dropped-direction line — what was dropped, why, and what reopens it. The ADR keeps its path, so every reference naming it stays valid |
| A new term becomes necessary | one line in glossary.md — the current skill walking this table lands it immediately |
| The task is merely bigger than expected | no document change — promote the card to a folder (split's promotion procedure) |
| An observation confirmed in code about a capability other than the one being worked on | one canonical `capability note` line in journal.md carrying that capability's number. Do not edit the other capability's document directly — its next closure harvests the line |
| Something confirmed in code about a shared contract or the foundation | an ADR when it produced a decision hard to reverse (arch's three conditions); arch.md's `Risks` when it is something that breaks first; otherwise one attributed open-item line in journal.md — where it lands (or whether it is discarded) is a person's decision, and the open-item row below (resolve through another row, then delete) is that line's consumer. Never write it into the foundation's verified zone — what was not verified is not a verified state |
| A cross-task decision, or an open item a person must decide | one attributed line in journal.md. When an open item resolves, that line becomes the decision or lands through another row of this table, and is then deleted |

For a product re-run, use the canonical `product re-run pending` line above. Serialize
the whole disproved statement as one JSON string so newlines and quotes remain recoverable.

An update per this table (replacing a provisional value, fixing a signal text, etc.) is
itself a sanctioned modification path. Steps 1–4 run only when a lower layer must
**violate** an upper one.

Discoveries do not come only from card work — a decision confirmed in conversation also
lands through this table, immediately. The confirmed product.md's identity paragraph,
Capabilities, Boundary, and success criteria are modified only after user confirmation,
whichever path the change arrives by — the conversation in which the user confirmed that
change IS the confirmation. Planning lives as edits to product.md, arch.md, design.md,
and the legacy ADRs — never create a new planning document beyond them.

### Core document ownership

Core documents (`devflow/project/*`) are modified **only through this procedure or by
re-running the owning skill** — never edited in passing during a task.
Target ownership is fixed: product owns product.md and glossary.md; arch owns arch.md,
code-style.md, and the legacy ADRs; design owns design.md; adopt owns arch.md `Existing records`
and may add only a missing `Brownfield` field to an existing arch.md;
split owns the tree and task cards; verify owns verify.md. arch, or adopt in a brownfield,
owns the design zone under `devflow/project/capabilities/`; verify owns the verified zone
after creation. The same-numbered knowledge capsule folder belongs to the design-zone
writer, and the canonical baseline predicates govern its path, header, provenance marks,
and opening budget. Skills never delete, move, or edit the source documents a capsule was
processed from — disposition belongs to a person alone. The canonical baseline predicates
govern the initial empty verified
scaffold, the exact byte boundary,
the exact mechanical v0.10 migration, and the human-deletion exception.
Fixed target ownership means ownership of rerunning the whole document; the current skill walking this table performs a one-line update named by the table.

A document still being produced by a running product, arch, design, or adopt session is
a draft until the user confirms it — reconcile a draft's contradictions by editing the
draft on the spot, not through the procedures above, and when an already-inherited upper
document must change, put that edit into the same confirmation batch. Derive and present
the whole confirmation batch in memory; before confirmation, change no core-document path.
When an interruption leaves an uncommitted diff on a core-document path, do not use partial
bytes as input or guess whether confirmation occurred: resume does not route to the next
stage, and the owning skill either rederives the whole batch from HEAD and current inputs,
obtains confirmation, and finishes the Layer 0 commit, or lets the user discard that diff.

Records outside devflow — the memory and task lists an execution environment injects
into a session, documents in the repository that are not devflow's — are claims, not
canon. This is not an instruction to seek them out — it applies only to what is already
in context. When such a record contradicts a confirmed devflow document, do not silently
pass over it — report it. Until confirmation, follow the devflow document; after
confirmation, fix the side that is wrong — a devflow document through the
discovery→update table's path; an outside record with no means to fix it, the report is
the end.

## Integrity Check

Run at the gates that open the tree (start of split and resume). A tweak entry opens no
tree, so it is not such a gate — a disk anomaly is caught by the next full session's check.
**Report anomalies — do not fix them.** Auto-correction that misjudges accelerates
corruption. Correct only after user approval.

**Closed-folder projection.** Inside a depth-1 folder carrying `.done`, a machine query
reads only path names and status suffixes and opens no body — that folder's knowledge is
already folded into its capability document. Item 4 therefore judges only task cards
outside such a folder (a re-closure strips the folder's `.done` first, which returns those
cards to it). Items 1, 8, 9, and 13 concern claimed or pending cards, which item 3 already
reports there from the projection alone, so they add nothing. One exception: when an
evidence line names a path inside a closed folder, item 13 judges by that line — a
journal-side judgment that still opens no folder body. Every other item is judged from the projected names and
statuses, and one body inside is opened only when an item reports an anomaly at that exact
path. The same name set serves next-number derivation, the ban on number reuse, locator
resolution, and the `Covered cards` comparison.

1. Does a claimed card carry an `<id>` that matches no `devflow/users/*/owner.md` room
   (an orphan claim — the residue of a departed member or a typo; a bare `.wip.` belongs
   to item 6 and is not counted here)?
2. Are any numbers duplicated?
3. Is there a task card inside a `.done` folder that is neither `.done.` nor `.stale.`?
4. Does each task card's `Depends` parse under the state predicates' canonical or legacy format, with
   exactly one card existing for every dependency number?
5. Does a path referenced by HANDOFF fail to match exactly one existing path when every
   component's status suffix is removed from both sides of the comparison?
6. Is there a bare `.wip.` or a root `devflow/HANDOFF.md` (an ownerless claim, or an incomplete upgrade)?
7. Do two or more owner.md files claim the same git identity?
8. A bare `.wip.` has no claimant, so item 6 covers it and this item skips it. For every
   other currently claimed card, from the current claim commit that created its
   suffix through the integration tip, does a commit changing a same-number status path for
   that card have an author different from the claimant's owner.md git identity? Exempt a
   canonical commit that releases that claim during a user-authorized reassignment,
   departure, or planning transition. Inspect neither pre-claim commits nor earlier claim
   intervals.
9. Does a pending task card omit an `Approval` or `Review` field defined by split, or carry a
   value outside those formats?
10. Is a foundation, capability, or intermediate folder empty with no active
    layer-opening marker?
11. Does a non-capability folder have at least one direct child that is not `.stale.`, all
    such children with a `.done` status, but no `.done` on the folder?
12. Does a journal line whose timestamp is followed by `layer opening:`,
    `re-split pending:`, `maintenance routing pending:`, `product re-run pending:`,
    `product verification requested`, `product verification running:`,
    `product verification result:`, `capability closing:`, `capability note:`,
    `audit requested:`, `retrospective requested:`, `evidence-wait:`, or
    `evidence-finalizing:` differ from
    the canonical format above; does any `-json` value fail to parse as a JSON string; or
    does a decoded layer-opening `source-json` fail to match one of the locator forms
    above or resolve to exactly one source?
13. Does an `evidence-wait` or `evidence-finalizing` line's decoded card path fail to name
    exactly one claimed card; does its checkpoint hash not exist in this repository or
    name a commit whose message and card path match; or does the last `remote evidence
    check` line in that commit's card progress log have a JSON value different from the
    journal's `check-json`? A committed `evidence-finalizing` path may instead be absent
    when exactly one same-parent `.done.` card has the same number, name, and bytes; that is
    an interrupted canonical claim→done move, so work finishes its boundary. Otherwise
    first finish an uncommitted binding decision that both deletes the line and renames
    that card `.stale.`, then judge again.
14. Does a verify.md section contain a non-positive or duplicate existing `source id`; or
    does an Audit/Retrospective routing entry have a non-positive or duplicate adopted-
    finding number, or a `routing: pending` finding with no number? Does text after
    `routing prepared:` fail to parse as a JSON object or fail the exact keys, value forms,
    base relation, operation forms, applicability, prefix, or scope conditions in Routing
    write order below?
15. Does journal contain two or more active product-verification state kinds together;
    more than one `product verification running` or `product verification result` line;
    or a result line whose product, verification, code, or verdict field differs from the
    corresponding tree-root verify.md field?
An item-12, item-13, item-14, or item-15 anomaly blocks later routing and every tree write. Present the raw line, the
expected format, and the whole proposed replacement to the user. Use in that proposal
only values that parse from the raw line or are uniquely determined on disk; ask for
every other value. After the user confirms the whole replacement, land only that line
replacement in a binding-decision commit and restart the integrity check from item 1. A
`routing prepared` anomaly is the exception: never commit the corrected object alone.
Replace it in the working tree, compare the already-applied operations prefix with the object,
apply the remainder, change verify.md to `result`'s completed state, and finish the one
specified routing commit. If user confirmation cannot recover a missing object value, stop
without guessing an output or rollback.

## Model Tiers

**Never write model names in files.** Use tiers only. The actual model and reasoning
effort are chosen by the user, per session, in split's execution proposal.

| Tier | Role | Use for |
|---|---|---|
| T-high | Top-tier reasoning | Judgments and reviews. Keep them short — long runs don't justify the cost |
| T-mid | Standard reasoning | The default. Planning, splitting, ambiguous or entangled tasks |
| T-low | Implementation-focused | Implementation with a complete card, mechanical transforms, collection/cleanup |
| Below that | — | Never for coding |

Reasoning-effort rule: **judgments = higher tier + low effort, kept short. Design =
standard tier + high effort, kept deep.**

The harness dial — inversely proportional to tier:

- T-mid and above: destination + 3 lines of prohibitions. No path instructions —
  prescribing the method actively degrades performance.
- T-low: fully enumerate `Read first` + ordering hints + expanded prohibitions +
  the completion-signal commands verbatim.
- **If you don't have time to write a T-low-grade card, don't give that task to T-low.**

## Failure Ladder (applies to every retry)

```
1st failure → reinforce the card and re-dispatch (never re-dispatch the same prompt —
              failure signals a defective card)
              The heart of reinforcement is the failure's causality, not added
              instructions — one or two sentences on the card: what failed, why,
              and what happens as a result
2nd failure → raise the tier, or the main session does it directly
3rd failure → call the human. There is no 4th attempt
```

Repeated fix attempts under the same hypothesis during implementation are not ladder
counts — those belong to work's stuck-escape.
The failure ladder counts only prompt reinforcement, tier escalation, and a human call within one work run.
A completed card that crosses the verify boundary and later returns non-pass is counted by verify's `repair lineage` and `recurrence observation`.
A new root and recurrence observation 1 follow the normal fix route; recurrence observation 2 or higher returns to the human without an automatic card.
Do not combine the two counts or create a fourth attempt in the failure ladder.

## Status Notation

**A filename's status suffix is the source of truth for task state; the claimed card's
progress log is the only record of progress inside that task.** Never put task progress
in product, arch, design, code-style, or glossary. journal may contain only cross-task
decisions, open items a person must decide, and lines whose exact formats the canonical
rules define; it never records task progress or approval. verify.md may record
verdicts, failure routing, Audit and Retrospective event states, findings, and user
decisions. These records do not directly change card or folder status. A task card's
`.done.` evidence is its completion signal and applicable review; a capability folder's
`.done` evidence is verify's capability-layer pass verdict.

- No suffix = pending / `.wip.` = in progress / `.done.` = complete / `.stale.` =
  invalidated by an upper-level decision change, or a tombstone a canonical procedure
  left behind (recall)
- A claim is written `.wip-<id>.` — a bare `.wip.` is an ownerless claim = an
  integrity anomaly. Release strips the whole suffix back to pending (the progress log
  stays in the card). `.done.` and `.stale.` stay unattributed — completion's ownership
  is git's memory
- A person may hold several claims. One card is carried by one session at a time: disk cannot tell terminals apart,
  so never directing two terminals at one card is the user's part (README guideline)
- `.done.` **only after the completion signal passes, the review that applies to the card
  passes, and the commit lands.** In this system, "verification" is reserved for verify's
  capability and product layers
- A folder that is not a capability receives `.done` when it has at least one direct child
  that is not `.stale.`, and every such child has a `.done` status. `.stale.` task cards
  remain as history but are excluded from active-child counts and closure judgment.
  **A depth-1 capability folder receives it
  only after capability-layer verification** — verify grants it. The foundation folder
  (01) is not a capability: it closes with no scenario rite under the same condition
- Tree numbers are assigned once: foundation is `01`; capabilities receive `02`, `03`, …
  in product.md's capability-list order at first root opening. A capability not yet holding a number on disk
  derives it from its product.md list position — the first capability is 02, and a retired
  row keeps its place and counts. Once a folder, waiting file, or baseline holds a number,
  disk is the sole authority. At the tree root, a `.md` is a
  waiting capability file, not a task card, when its name equals a non-retired product.md
  capability's name and its number is that assigned tree number. Its body is the single
  line `# <number> <capability name>`; it has no `Approval`, `Review`, or completion signal.
  When opening the capability, split turns this file into the same-numbered, same-named
  folder and creates its direct task cards
- A retired capability gets `.stale` when it is an opened folder, or `.stale.md` when it
  is an unopened waiting file. Every card status inside an opened retired folder is void.
  The hook and the integrity check do not count inside `.stale` folders
- File base names and numbers are immutable identifiers. No renumbering, no reuse. A
  capability's number is likewise immutable; only the name half of its product.md row, its
  tree folder or waiting file, and its baseline file changes, and only together through the
  discovery→update row above. Mid-insertions use the `02.2b` form
- Record files that are not cards (`verify.md`, etc.) carry no status suffix and are
  excluded from status judgment

## The Tweak Lane

The unit of judgment is the item — a request carrying several items judges each against
the three questions separately. The three questions apply only to an item that requests a
change to the repository's artifacts — an item that changes nothing (a question, an
explanation, a status check) is not a tweak item even when all three come out "no"; it
belongs to the normal procedure: a session with nothing to change finds no edit to make,
no check to run, and no commit to land in this lane. An item is a tweak only when all
three answer "no" — any
uncertainty means it
is not one: ① does it change a precondition-to-outcome transition the user sees; ② does it
produce a design decision, or conflict with an existing decision, design token, or ADR;
③ does it leave a trap the next worker must know about.
The three questions are judged from the request itself and the documents this lane
reads — do not search beyond them to manufacture uncertainty. A conflict already visible
in this session's context is not searched-for, though — a visible conflict answers ②
"yes". When no transition change,
conflict, or trap shows there, the answer is "no".
An item that passed the gate is written into no journal line — this lane handles it inside
the conversation that carries it, and a maintenance record line holds only the items that
failed the gate. A recorded request line is consumed whole by the card planning commit, so
a passing item mixed into that line would be consumed with neither a card nor a record and
vanish without trace on interruption.
A tweak's diff is its complete record. So it runs with no card, no journal line, and no
review. This lane presupposes a repository devflow has entered — with no `devflow/` at the
repository root, do not tweak: the lane would plant a room in a repository that never
chose adoption, so the no-tree exception's adoption question comes first.
First confirm by machine that this lane's commit has a safe place to land:

- When `git symbolic-ref -q HEAD` is empty (a nameless HEAD), do not proceed — report that
  fact and the branch selection or creation choices. A tweak commit rides no integration
  boundary, so a commit on a nameless HEAD lands in no branch and survives only in the
  reflog.
- When any verify.md in the working tree contains `routing prepared`, do not proceed —
  judge no item this lane holds as passing and hand those items to the normal path (that
  transition finishes first, and the request-recording row receives them). That transition
  is pinned to a base commit id, so one tweak
  commit advancing HEAD turns a recoverable state into an integrity anomaly.
- When the readable integration tip is not an ancestor of HEAD, the disposition is the
  same — judge no item this lane holds as passing and hand those items to the normal path.
  The readable integration tip is the tip the integration rule above reads without a
  network command — for a remote-tracking branch, the local ref as last fetched; when no
  tip can be read at all, hand off the same way. A "no" reached from a stale checkout's
  documents produces a commit that conflicts with a decision already landed on integration.

When the checks pass, declare "handling as a tweak — <item>" in one line (the
conversational request is
the approval), read the existing product.md, arch.md, design.md, and code-style.md — and,
when the item could touch a name or term (user-visible wording, identifiers, messages —
anything that carries a name), the existing glossary.md too: term decisions live only
there, and nearby code shows the current spelling without marking it as a decision; when
unsure whether the item touches one, read it (it is a small document, one term per
line) —, and make
the change. Immediately before editing, look at each target path's uncommitted changes:
changes this session made for a claimed card land first as that card's wip checkpoint.
This session's edits that a flipped item left in the
working tree are that request's card's share: back them out before this lane's commit
and reapply them to the working tree after (a commit records the file's whole content —
a sibling tweak item's edits in the same bundle are not these, and ride this commit).
And for changes this session did not make, do not guess their owner — report that path
and change and
follow the user's decision. A Git commit records a path's final content without
telling changes apart by author, so another flow's changes left in the same file ride the
tweak commit as they are. After the change, run the one narrowest executable check that
covers the changed files — their
tests when they have them, otherwise lint or build. When the check fails, repair it
within the item until it passes — and when what the failure reveals flips one of the
three questions, the switch rule below applies. Then, immediately before committing,
compare the target paths' diff against the changes made for the items this commit
bundles — when content
outside them shows, do not commit: back my edits out, reapply them after the other flow
has
committed, and say on the spot that I stepped back. When the user confirms those changes
as a dead session's leftovers that no live flow owns, take them over or discard them by
the user's decision and proceed. The side that steps back is fixed as the tweak side, so
no mutual wait arises.
Then land a single
`<id> tweak <unit number>: <what>` commit. Resolve `<id>` by the Identity and Rooms
rules — with no room, the joining transition creates one, and that room commit is the
sanctioned exception to this lane's no-devflow-path rule (it is the product of identity,
not of the request). Creating a room is a binding decision, so it cannot land during a
blockade — a roomless session does not tweak then; it reports the exact cause. The unit
number is the depth-1 unit canonical recognition resolves when applied to that item's own
text — not to the whole conversation: a conversation whose two items each name a different
unit resolves to a set of two, which selects no unit — or `01` when none resolves.
Several tweak items in one request bundle into one commit per depth-1 unit. Beyond that,
no `devflow/` path
is touched — the moment one would be needed, the item is not a tweak. This lane is not
routing — the pre-routing integration read and state restoration do not apply here (the
machine checks above are not restoration but this commit's landing preconditions). When
any of the
three questions flips to "yes" after the declaration — in any phase: the reads, the
change, or the check —
stop, report, and switch to the ordinary path
(starting with the request's journal record) — the edits made so far stay in the working
tree, and the session that claims that request's card takes them over with the user's
confirmation (resume's report of uncommitted paths is what surfaces them). A discovery
during tweak work follows
the discovery→update table regardless of change size. The commit is not a binding
decision — a blockade does not block this lane.

## Commit Discipline

- **Every devflow commit carries only its own paths.** Whatever else this working tree has
  staged, a commit contains exactly the paths its own rule names — a file another flow in
  the same folder staged earlier never rides along.
- **Layer 0 commit**: product, arch, design, and adopt land each core document in one
  commit immediately after the user confirms it — message `<skill> — <document filename>`
  (adopt lands all adoption documents together as `adopt — layer 0`). A document created
  alongside another (glossary.md with product.md) rides the same commit. A single-field
  completion of an existing document uses the same message form. This commit is a
  binding decision.
- **Capability-design commit**: after every confirmed Layer 0 commit has landed, arch, or
  adopt in a brownfield, writes the design zones for the expected capability documents as
  its final output. Land only those capability documents and their knowledge capsules as
  `arch — capabilities` or `adopt — capabilities`; if no capability bytes change, do not
  commit. This is a binding decision.
- **Planning commit**: split bundles newly created or revised pending cards,
  user-confirmed card-dependency format corrections, tree structure, card Approval and
  Review, arch.md `Settled by` replacements, verify.md
  failure or adopted-finding routing, and deletion of every layer-opening marker it settles
  in one commit. It needs no completion signal because it is not an
  implementation result. Message: `split — <opened layer>`. A promotion's `NN.N promote`
  is the dedicated message for the same commit class. It lands on the
  integration branch as a binding decision.
- **Routing write order**: once the exact result of a Failure-history or adopted-finding
  route is determined and required user approval is complete, replace `routing: pending`
  with `routing prepared: <JSON object>` before output. The object has exactly one each of
  the keys `base`, `result`, and `operations`, and no others. `base` is the unabbreviated full
  commit object ID output by Git for HEAD immediately before that replacement. `result` is one of `routing: fix
  cards <card number>(+<card number>)*`, `routing: documents <JSON array of exact
  devflow/project paths>`, and `routing: product re-run <journal timestamp>`. In the first
  form, `*` is notation rather than a recorded character: write one or more exact card
  numbers, prefixing every number after the first with `+`.

  `operations` is a JSON array in application order. Each member is exactly one of
  `{"op":"write","path":<path>,"content":<final UTF-8 string>}`,
  `{"op":"move","from":<path>,"to":<path>}`, and
  `{"op":"delete","path":<path>}`, with only the shown keys. Paths are repository-relative
  `/` forms that begin with `devflow/` and are neither absolute nor contain `..`. A write or
  delete never targets the current verify.md. A move may rename an ancestor status path of
  that file; the current verify.md path then follows beneath the new ancestor. A write
  creates required parent folders and creates or replaces a regular file. A move renames an
  existing status path to an absent path. A delete removes an existing regular file. Every
  member must change its input tree, and
  the full array must apply without error and produce only outputs required by the selected
  canonical route.

  Draft cards written before the execution proposal must be protected by a committed layer-
  opening marker and exactly represented by the first write operations. For an uncommitted
  prepared object, HEAD must equal `base`. If the object was committed to HEAD in violation
  of this rule, that commit's first parent must equal `base` and the current verify.md must
  contain the same object. Apply operations in order to the `base` tree and track the current
  verify.md path through each ancestor move. For comparison, change only that file's one
  exact `routing prepared` field back to the same source's `routing: pending` value from
  `base`; exclude no other byte. The whole difference between `base` and this normalized
  checkout tree, including staged, unstaged, and untracked paths, must equal exactly one
  prefix, including the tracked path move. Anything else is an integrity anomaly outside
  the payload. Without
  committing the prepared object again, apply only the remaining suffix, change the tracked
  verify.md's prepared object to the
  completed state named by `result`, and land all of it in the one specified commit. Never
  select a new route or create the output twice.
- **Carry line.** After the upper-document feedback judgment and immediately before the
  final task commit, work appends exactly this one line to the claimed card's progress log.

  ```text
  YYYY-MM-DDTHH:MM:SSZ carry: <a fact that could make the next card in this depth-1 unit wrong | none>
  ```

  It holds only the residue with nowhere else to land — a trap local to this unit, an
  approach this card disproved, a measurement no document records. Anything the
  discovery→update table, journal, a capability document, or the code already received is
  not written here. The line rides the final task commit, so the canonical claim→done move
  stays byte-identical.
- **1 task = 1 commit.** Commit only after the completion signal passes (see the
  exception below when only remote evidence remains). The message is exactly the card H1
  with only `# ` removed, such as `02.2 signup API`.
  The card stays claimed after the final task commit until boundary cleanup. When the
  last commit that changed it has this exact subject, the final task commit is complete:
  that commit includes the claimed card and its progress log at that point. work does not
  make it again and finishes only upper-document feedback and the boundary.
- **Canonical claim→done move**: the claimed card path in HEAD is absent from the working
  tree, exactly one `.done.` card in the same parent has the same number and name, and the
  two files are byte-identical. Whether git reports a rename or a deletion plus untracked
  file is not part of the judgment. An uncommitted move is an unfinished boundary.
- Mid-checkpoint commits for long tasks are allowed as `02.2 wip: <what>`. The "current
  diff" any checkpoint-style commit carries always means the changes this session made
  for that card — the first bullet's own-paths rule, scoped to sessions.
- When only remote evidence (CI, etc.) remains in the completion signal: get the review
  first, then commit the code and progress log as an `NN.N wip: evidence-wait`
  checkpoint. Immediately before that commit, append the exact line below to the progress
  log. `check-json` is a JSON string containing one exact command or URL that returns the
  remote result.

  ```text
  YYYY-MM-DDTHH:MM:SSZ remote evidence check: check-json: <JSON string containing the exact remote-result command or URL>; verdict: unrun | pass | fail | pending | inaccessible | no-verdict; detail-json: <JSON string containing result detail>
  ```

  Before writing journal or any other boundary change, integrate the current
  branch through that checkpoint by arch.md's `merge` method. If rebase changes the hash,
  use the changed hash. Put that hash in the canonical `evidence-wait` line, land the line in a
  `boundary — evidence-wait <number>` commit, and push both commits. The card stays
  `.wip.`. If interruption occurs after the checkpoint but before the record commit,
  work finds that exact checkpoint and finishes only the line, record commit, and push.
  Parse `card-json` and `check-json` as JSON; do not split them on delimiter text.
  The checkpoint's exact message is `<id> NN.N wip: evidence-wait`.

  Immediately before the checkpoint, use `unrun` and an empty string for `detail-json`.
  To process the evidence, run the command or open the URL and append a new line in the
  same format with the current verdict and detail. A pending result retains the journal
  line and card. A pass replaces
  `evidence-wait` with `evidence-finalizing`, preserving the other fields, in the final
  task commit. A committed `evidence-finalizing` line means the task commit is complete
  and only upper-document feedback and boundary cleanup remain. work never reruns the
  completion signal; it renames the card `.done.` and deletes that line
  in the boundary commit; it does not make the final task commit again. A fail records the result in the progress log and
  deletes the line in an `NN.N wip: remote evidence failed` checkpoint, then returns to
  the failure ladder. An inaccessible pointer or one with no verdict is unverified and
  retains the line.
- **Boundary commit**: bundle status renames, HANDOFF, journal, verify.md, and documents
  fixed by upper-document feedback (see work) into one commit. Message: `boundary — <what closed>`.
  HANDOFF never gets a dedicated commit — it only rides here.
  If a task boundary records a final task commit or checkpoint not yet on
  integration, first integrate the current branch through that commit with arch.md's
  `merge` method before writing any status rename, HANDOFF, journal, verify.md, or feedback
  document change to the working tree. Documents already landed on integration as binding
  decisions do not ride again — the boundary commit carries renames, HANDOFF, journal,
  verify.md, and the marker only.
  `merge-commit` makes a non-squash merge commit on integration; `rebase` rebases the current
  branch onto the fetched integration tip, then fast-forwards integration. If rebase changes
  a checkpoint hash, write the changed hash to journal. Only after the commit recorded by
  the boundary is an ancestor of the integration tip, create the boundary commit on that
  branch. A boundary with no task commit to record is created there directly. Then route
  the next stage.
- **Verification-state commit**: land product verification running, result, and reported
  states respectively as `boundary — product verification running`,
  `boundary — product verification result`, and `boundary — product verification reported`.
  Land a capability verification's fail or unverified result, and a pass result with a
  closure-gate failure, as `boundary — capability verification result <capability number>`.
  Land an Audit/Retrospective event's pending, result, and decision states respectively as
  `boundary — verify event <Audit|Retrospective> <source id> <pending|result|decision>`.
  Every verification-state commit, including `boundary — verify source ids`, is
  shared state, so land it on the integration branch. A working-tree state that one of these
  commits, or the `boundary — begin <capability number>` commit, specifies before that commit
  lands is a **canonical verification-state transition**; a consumer finishes its specified
  commit first without re-executing. For the `boundary — begin <capability number>` commit,
  the specified state is the passing verify.md record, one exact baseline path of the closing
  capability (absent, partial, or any bytes), and — when already created — the
  capability-closing record; the baseline predicates govern that baseline file's regeneration
  before that commit lands. Outside a canonical capability-design commit, the canonical human-deletion exception,
  restoration of one complete one-boundary file from a user-identified Git revision to its current expected path, or this begin transition, any
  `devflow/project/capabilities/` diff is an integrity anomaly.
- **git belongs to the main session.** Subagents implement and write the progress log —
  they never commit, rename, or push.
- Prefix commit messages with your id — `<id> 02.2 signup API`,
  `<id> 02.2 wip: ...`, `<id> boundary — ...`. Every message form in this document names
  only the part after the id; prepend `<id> ` to all of them, and read every recorded
  subject the same way.
- A **binding decision** — one that affects shared documents, tree structure or
  numbers (folders, minting), a card someone else claims, the initial
  `.wip-<my id>.` claim rename, or a release that returns my claimed card to pending. Other status renames of my claim already visible on
  integration are not binding decisions. Land a commit containing only the files that constitute that decision on
  the integration branch (arch config) now — when integration cannot be written, the
  publishing paragraph's blockade rules outrank this "now". For a planning commit, the whole bundle
  enumerated above constitutes that decision. No unrelated change rides along. Everything else
  rides your own branch. Do not start implementation until the initial claim commit has
  landed on integration and the current branch contains that integration tip.
- If pulling integration shows someone else's claim already landed on the same
  number, you lost — copy your progress log into the surviving card and step back.
- Numbers are minted only on integration, so duplicates arise only while a card is pending
  and unclaimed. At that stage the later-merged side moves to the mid-insertion form
  (`03.2` → `03.2b`) with 1 journal line. Never renumber a card already claimed or
  finished; report it as an integrity anomaly — that number also lives in commit subjects,
  outside issues, and people's links, which fixing files and dependencies does not reach.
  A verify source id follows the same principle.
- HANDOFF merge conflicts take the side whose `# HANDOFF · <timestamp>` header is newer. A
  digest marker keeps the descendant hash (resume's marker rule).
- Journal merge conflicts resolve 3-way. Compare the conflicted region against the
  conflict's common-ancestor journal blob — the `git merge-base` commit for a merge, the
  replayed commit's parent for a rebase: a line present in the base and absent on
  one side was consumed — never restore it. A line absent from the base is an addition —
  keep both sides' additions in timestamp order, mine first on a tie. A union resolution revives already-consumed
  requests, and the same fix gets planned twice under a new number.
  Squash merges are forbidden (they erode every rule built on `NN.N` history) — the
  policy is declared in arch's config.
- To undo, use a revert commit — never erase history.

## The Verification Iron Rule

**What was not executed is not "passed" — it is "unverified."**
Reading the code and thinking "it looks right" is not a verdict.
