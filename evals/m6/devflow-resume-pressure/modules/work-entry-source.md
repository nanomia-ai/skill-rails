---
name: work
description: Implementation. Takes one task card, codes it, keeps the progress log on disk, runs the completion signal, and commits. Use when starting to code, continuing work, or beginning implementation.
---

# work — Implementation

First read the canonical rules (`../principles/SKILL.md`) and canonical state predicates
(`../principles/state-predicates.md`).

Purpose: carry one task card all the way to its completion signal, then commit.

## Preconditions

When this project is coming up from a version without rooms, finish the canonical room
transition before anything below. For each bare `.wip.` card, ask the user whether it is
mine: rename a confirmed one to `.wip-<my id>.`, and release one the user does not
attribute to me by stripping the whole suffix back to pending — its progress log stays in
the card. In that same commit, replace with the new path the `card-json` of every journal
`evidence-wait` or `evidence-finalizing` line naming the exact path that rename changed,
preserving its timestamp, checkpoint, and `check-json` byte for byte. Never auto-release an
evidence claim whose owner is unconfirmed — the evidence cannot be preserved, so report the
exact blocker and stop. Independently of that answer, move a root `devflow/HANDOFF.md` into
my room. Land whichever of these applies in one `<id> boundary — room upgrade` commit. When
one side is applied and the other is not, judge by that commit subject and finish only the
remainder and the commit.

1. Apply the canonical Git requirement — a work tree and a git identity — before anything
   below.
2. Before choosing an ordinary claim, finish remote-evidence transitions for my claimed
   cards in the order below. Within each state, use timestamp order and then journal line
   order.
   Whenever a branch below executes or rechecks remote evidence, append the canonical exact
   `remote evidence check` line before following that result's branch.

   - A committed `evidence-finalizing` line in HEAD means the final task commit is done.
     Read only the recorded completion-signal, review, and checkpoint linkage from the log
     and commits; never execute the signal again. Then repeat the upper-document feedback
     judgment below. If feedback enters the Document Hierarchy procedure, that procedure
     deletes the evidence line and this completion path ends. Apply a compatible update to
     the working tree through the discovery→update table before the `.done.` rename and
     land it in the boundary commit below. Make no final task commit; finish only the card's
     `.done.` rename, the compatible document update above, applicable foundation and
     intermediate-folder closures, HANDOFF, and line deletion in a boundary commit. If that rename and deletion
     already started in the working tree, finish that boundary first
   - When `evidence-wait`→`evidence-finalizing` and its pass result exist only in the
     working tree, run `check-json` again. On a current pass, make no final task commit yet;
     continue at the upper-document feedback judgment below. Pending, inaccessible, or no
     verdict restores the line to `evidence-wait`. A fail deletes the line in an `NN.N wip: remote evidence
     failed` checkpoint and returns to the failure ladder
   - When HEAD's `evidence-wait` line is deleted only in the working tree and the claimed
     card's last uncommitted `remote evidence check` line has the same `check-json` with
     `verdict: fail`, finish the current changes as the `NN.N wip: remote evidence failed`
     checkpoint and return to the failure ladder. Do not restore the line or recheck the
     remote result
   - When the last commit that changed a claimed card has the canonical exact evidence-wait
     checkpoint message but no evidence line names that card, recover the canonical
     `evidence-wait` line from the last `remote evidence check` JSON in that commit's
     progress log. Land the line in `boundary — evidence-wait <number>` and push the
     checkpoint and record commits. A missing or undecodable JSON line is an integrity
     anomaly
   - For a committed `evidence-wait` line, run its `check-json` command or open its URL only
     after pushing the checkpoint and record commit succeeds. When the line is uncommitted,
     finish its record commit and push first. On a pass, do not change the line or make the final
     task commit yet; continue at the upper-document feedback judgment below. A fail makes
     the failure checkpoint above. Pending, inaccessible, or no verdict retains the line
     and card

   After remote-evidence transitions, if the canonical claim→done move is uncommitted, or
   the last commit changing one of my claimed cards that no `evidence-wait` or
   `evidence-finalizing` line names has the
   canonical final task subject, open no new work. The final task commit is already complete
   under the canonical commit discipline; make no second final task commit and finish only
   upper-document feedback and the boundary.

   Any number of claims of mine, in any units, is ordinary concurrent work — several
   sessions each carry their own card. Others' claims do not count —
   they are read-only reference (the canonical rules' "Identity and Rooms").
   If the claimed card lacks `Approval` or `Review`, has `Approval: pending`, or has
   noncanonical `Depends`, make no new implementation change. First land any current diff
   or progress log in an `NN.N wip: legacy card migration` checkpoint. Then release the
   card, finish split's legacy normalization, execution-proposal approval, and planning
   commit, and reclaim it.
   Read the claimed card's `Depends` under the state predicates' canonical or legacy format. If any
   member is unparseable, or a number does not resolve to exactly one card, report an
   integrity anomaly and stop. If any resolved card is not `.done.`, do not resume
   implementation; return to split, release the original card, and finish the prerequisite.
   If journal in HEAD or the working tree has an active layer-opening marker whose
   `source-json` decodes to a `card:` locator naming my claimed card, do not resume
   implementation; return to split to finish that marker's planning commit first.
3. Select this invocation's card and begin. When this session already reported an exact
   card path and the user approved it, that card. Otherwise the first entry in canonical
   candidate order over my remaining claims plus every pending card that is ready under the
   state predicates. Continue a claim of mine; claim a ready pending card as below. Never
   claim a card that is not ready. When the user named a card and this selection does not
   take it, say which card it took and why before claiming anything. When claiming a
   pending card in a unit where I already hold claims, name those claims in one line, and
   when the claimed card's Approval `parallel:` value does not carry them, add that fact
   in one line — information, not a question, so proceed without waiting for an answer.
   When this session left uncommitted changes on another card of mine, land them as that
   card's `NN.N wip:` checkpoint first — uncommitted changes this session did not make
   belong to another flow, so leave them untouched. The one exception is what the user
   confirms as this card's leftover (edits a tweak flip left behind, for instance) — once
   confirmed, take them over and treat them as changes this session made. Return to split to normalize a
   noncanonical `Depends`; report and stop on an integrity anomaly.
   Before claiming, pull the integration branch and finish the digest (resume's
   digest procedure). The rename commit to `.wip-<my id>.` is the claim (message:
   `<id> 02.4 claim` — a digest.md marker a just-before-claim digest advanced rides this
   commit). Land this initial claim on integration as the canonical binding
   decision and include that tip in the current branch before implementation. If a
   competing claim rejects the integration update, fetch again and follow the canonical
   rules' lost-claim rule (copy my progress log into the surviving card and step back).

## The Loop

```
Read the card fully (including Coordinates and Identity — know what this is a part of)
+ read devflow/project/product.md, devflow/project/code-style.md, and
  devflow/project/arch.md alongside
  (a decision that never reached the card does not exist for the implementer — from arch,
   at minimum the Stack, Code structure, Provisional, Risks, and verify_channel sections)
+ read devflow/project/design.md, devflow/project/glossary.md, and devflow/journal.md in
  full if they exist
+ read every direct dependency card named in `Depends` in full
+ unless `Read first` is `none`, read every exact path it names. If a path is missing,
  report it; do not guess a substitute. A baseline path directly under
  `devflow/project/capabilities/` is legacy wiring: do not open it or report its absence
  through this field; defer it to the number judgment below. Do not open a path listed only
  in arch.md's `Existing records`
+ take the leading number from the claimed card's depth-1 ancestor directly below
  `devflow/tree/`. Comparing numbers as integers, if exactly one document under
  `devflow/project/capabilities/` has that number, select its path but do not open the body
  yet. Apply the consumer judgment below first; only when its shape gate permits, read both
  zones and the exact Binding ADR paths regardless of `Read first`. Foundation and research
  cards follow the same rule
+ when a same-numbered knowledge capsule folder exists beside the capability document just
  read, project only the capsules' first-line headers:
  `node <plugin root>/scripts/project-knowledge.mjs project --capability <capability number>`,
  never without `--capability`. Open bodies only for capsules named by the card's
  `Read first` and capsules whose "when to open it" matches the card's destination and
  target, through the same tool's `select --path <exact path>` (repeat `--path` for several).
  The tool enforces the opening budget as a hard cap — over it, it returns zero bodies with
  the candidate list and the cost; pass that report to the user unchanged and either narrow
  or obtain explicit approval (`--approved` on the same command). An opened capsule's `conjecture` sentence is not an
  implementation basis, and a `dispute` leans on neither arm before the decision — when
  continuing requires leaning on one, stop and report. When a capsule's claim moves into the
  progress log, a `carry:` line, or a delegation briefing, its provenance mark moves with it
+ run a mechanical query over every non-`.stale.` `.done.` card below that depth-1 unit whose
  number is not in the capability document's `Covered cards`, emitting each card's number and
  the last `carry:` line of its progress log and nothing else. Read only that output and open
  no card body. With no capability document, or one whose shape gate blocked its body, the
  complement is every such card. When the body was read but `Covered cards` is absent or
  does not parse as a JSON array, the complement is likewise every current non-`.stale.`
  `.done.` card — never guess the empty set. Delivering a line twice is harmless; losing
  knowledge is unrecoverable. A card with no `carry:` line contributes nothing
  ↓
When the current card, its direct-dependency cards, or arch's Code structure or shared
contracts name one or more exact code paths, search only those paths for the responsibility
named by the card. Reuse a matching implementation or report its conflict. Do not search
other paths to prove absence
  ↓
Implement  ←→  append to the progress log (after completing one named card step, after
  ↓            choosing among alternatives, and after a run result changes the next step.
  ↓            Disk is the source of truth. If the session dies at any moment,
  ↓            this log must identify the exact next implementation point)
  ↓            **Gate: the log must be current before starting any run that takes minutes
  ↓            or can fail (build, measurement, completion signal, install).** Those are
  ↓            exactly the runs that tempt you to postpone writing — and exactly when a
  ↓            session dies. Repeats of the same attempt can be batched into one line.
  ↓            On a long card, checkpoint-commit `02.2 wip:` at the same moments
  ↓            (the main session commits)
Run the completion signal — actually run it. Record the result in the log
  ↓            A signal scoped to this capability's paths survives another flow's
  ↓            uncommitted code in the same working tree; a repository-wide one does not
  ↓
Review — omit this step when the card's `Review` is `waived`. Omit `not-applicable` only
        when the diff contains no real-code change. Otherwise brief a clean
        subagent/fresh session with `reviewer.md` beside this skill,
        **verbatim — never summarized** — main holds the implementation history, so
        main can never be the clean one — and give it **only the card (Progress log section
        excluded) + the diff limited to this card's paths + code-style.md + glossary.md + journal.md + this card's capability
        document design zone and every existing file at an exact path listed in that zone's
        Binding ADRs section when that zone exists +
        exactly one design-freshness, reconfirmation, or baseline-missing projection**
        (project files only when they exist). Do not enter
        review when a design hypothesis used by
        the implementation has not been reconfirmed. No implementation backstory — the
        progress log IS the backstory. The code must explain itself.
        Recommended: T-high + low effort, kept short.
        Objection → fix → re-review. A fix that changed the diff re-runs the completion
        signal — against the changed code, an earlier pass is unverified. Failure ladder
        applies — 3 strikes calls the human
        When only remote evidence remains in the completion signal, finish the canonical
        exact `remote evidence check` log, evidence-wait checkpoint, journal record commit,
        and push, then end this invocation. Upper-document feedback, the final task commit,
        and `.done.` wait for the evidence verdict in the next invocation
  ↓
Upper-document feedback judgment — before the final task commit, ask whether this card
        settled or contradicted anything an upper document left open (a Provisional row
        in arch, a success criterion in product, an ADR premise). If the change would
        make the current card `.stale.`, do not make the final task commit. Instead make
        an `NN.N wip: upper-document change` checkpoint, enter the canonical Document
        Hierarchy procedure, and leave this completion path. For a compatible update,
        write the exact document path, heading, and replacement text in the progress log
        and continue
  ↓
Carry line — append the canonical `carry:` line to the progress log
  ↓
Final task commit — the canonical 1 task = 1 commit discipline. On a remote-evidence pass,
        this commit replaces `evidence-wait` with `evidence-finalizing` while preserving
        its fields
  ↓
Integration gate — under the canonical rules, integrate the task commit before any
        boundary working-tree change
  ↓
Land upper-document feedback — when the judgment recorded an update, fix that document
        before renaming through the canonical rules' discovery→update table. **A card that measured an answer but
        left the document that posed the question unchanged is not done** — the stale
        upper document outranks your measurement, and the next implementer follows it.
        User confirmation for product.md edits follows the canonical rules' Document
        Hierarchy section (identity paragraph · Capabilities · Boundary · success criteria).
        When an execution fact this card settled will be reused by later
        cards, promote it to the statement that owns that
        fact — the number, the execution conditions under which it is true, and the command
        that measures it again, in one block. The progress log points only at that document
        and place and never duplicates the observation
  ↓
Rename the card to .done. — only once the canonical rules' status-notation conditions
        for `.done.` are all met
  ↓
Foundation and intermediate folders: close each eligible non-capability ancestor under
        the canonical Status Notation, stopping before the depth-1 capability folder
  ↓
Boundary commit — bundle renames, HANDOFF, journal, and the documents fixed by feedback
        (the canonical rules' commit discipline)
  ↓
If a depth-1 capability folder reaches the canonical verification gate → propose verify
        (capability layer)
```

The consumer judgment for an automatically read capability document is as follows. Compare
numbers as integers. If the document is absent, report `baseline missing: <number>` in one
line, continue from Layer 0 and the card, and give reviewer
`design: baseline missing — judge from the card and supplied shared documents`. If two or more documents have
the same number, report their exact paths, select none, and continue with the same projection.

When the unique file has the canon's exact `legacy v0.10` shape, report `legacy baseline:
migration pending — <path>` in one line, open no body, and continue active work with the same
baseline-missing projection.

When the selected file has zero or multiple fixed boundaries, guess no zone and read no
body. Report the bounded shape facts in one line and continue with the baseline-missing
projection above. With one boundary but malformed section or metadata shape, read the zones
and mark the affected zone a hypothesis.

With one boundary, open only exact paths from a valid Binding ADRs section. If that section is
absent or unparseable, open and infer no ADR path and make the design zone a hypothesis. If a
path named by a valid section is missing, report it, make the design zone a hypothesis, and
guess no substitute.

With exactly one fixed `## Verified state` boundary, check section and
metadata shape. A malformed zone is a hypothesis. Run the single-line command
`git log -1 --format=%H -- devflow/project/product.md devflow/project/arch.md devflow/project/glossary.md`. When its
output equals `Design head`, design statements in Purpose, Boundary, Concept model,
Invariants, and Non-goals are fresh; when it differs or is empty, they are a hypothesis.

Put `Scope paths ∪ Consumed paths` in canonical path order without duplicates. When the
union is empty, run no git command and treat verification statements as a hypothesis. When
it is nonempty, pass every path to `git log -1 --format=%H --` as one `:(literal)` pathspec
and one shell-quoted argument. When the output equals `Scope head`, this comparison is
fresh; when it differs or is empty, it is a hypothesis. Verification statements are also a
hypothesis when the exact-path set in Consumed contracts differs from `Consumed paths`, or
when a row's other-capability number differs from or is ambiguous under the current provider
mapping in arch.md's Code structure. Enumerate non-`.stale.` `.done.`
card numbers below that capability's folder from names alone in canonical card-number
order. When they differ from `Covered cards`, when any non-`.stale.` card below that folder
lacks a `.done` status, or when `Verified at` is `none`, verification
statements are a hypothesis. Verification statements are Main flow, Lifecycle, Current
behavior, Entrypoints, Consumed contracts, Traps, and Verify.

Before implementation uses a design hypothesis, reconfirm it in the exact authoritative
section already read from product.md, arch.md, or glossary.md, or at an already-open exact
path from a valid Binding ADRs section. Reconfirm a verification
hypothesis in current code or cards inside the existing read set and code-search boundary,
which for reconfirmation alone also holds `Consumed paths`.
Expand neither further. Keep every design reconfirmation as `exact path#heading`, without duplicates
and in canonical path order, in the reviewer projection. Use the canon's current path/status
notation for the symmetric difference of current completed cards and `Covered cards` as the
post-baseline change list. Report one line: `baseline <Verified at>, design <fresh|
hypothesis|missing>, verification <fresh|hypothesis|missing>, <M> card changes since`; with no
baseline, the Verified-at value is `missing`.

When the user, mid-card, asks for something that qualifies under the canonical rules'
tweak lane, make separate `tweak` commits through that lane — one per depth-1 unit, as
its rule directs — and return to the card —
the commit carries only its own paths, and changes the card work made to the same file
land first as that card's wip checkpoint through the tweak lane's target-path check. A
Git commit records a path's final content, so without that check the same file's card
changes ride the tweak commit.

## When You Must Leave the Card — stop and go up

If you need to modify something outside the card's scope (shared contracts, core,
another capability):

```
① Stop. Write 2 lines of "why this is needed" in the progress log
② Land the current code and progress log in a `02.2 wip: <blocking reason>` checkpoint
   commit
③ While the original remains claimed, use split to create a card in the required location
   (e.g., 01-foundation/01.7-auth-contract-v2.md), then add its number to the original
   card's `Depends` first. Get the new card's execution proposal approved, then remove the
   original claim suffix last. Put the new card, dependency change, approval, and release
   in one planning commit
④ Once that planning commit is effective, handle the new card. The original card becomes
   ready again when that card is `.done.`
```

Silently widening scope is the worst failure. Stopping is not failure — it is correct
operation.

If the conflict is with an **upper document** (product, arch, code-style) rather than
code, follow the document-hierarchy procedure in the canonical rules — fixing the
document comes before creating a card.

## Letting Go of a Card — parking only on explicit request

Moving to another card needs no procedure: claim it (precondition 3). Parking — a release —
happens only when the user explicitly asks to let this card go. A card that a journal
`evidence-wait` or `evidence-finalizing`
line names is not parked — releasing it would leave that record pointing at an unclaimed
card, which integrity item 13 reports. Finish its remote-evidence transition first. While
its verdict stays `pending`, answer a park request with that reason and leave the card
claimed — any other card can simply be claimed instead.

```
① Land the changes this session made for that card, and its progress log, as an
   `NN.N wip: <reason for stopping>` checkpoint. Uncommitted changes this session did
   not make belong to another flow and do not ride. With nothing changed, make no commit
② Remove the claim suffix, returning the card to pending
③ Claim, in this same invocation, the replacement card the user named in it, when that
   card is ready under the state predicates. With no card named, or a named card that is
   not ready, claim no automatic candidate: say which condition fails and ask what to do. Integrate the checkpoint first,
   then land the release as the canonical binding decision it is
```

The card just parked keeps its approval and dependencies, so canonical candidate order puts
it first again — an automatic candidate at ③ would make the switch cancel its own purpose.
Invent no state that preserves "later" across sessions: this switch's destination holds
only inside this invocation.

This does not collide with the ban on mid-task handoff: parking is a release, not a handoff.

## Stuck-Escape — event-based

If the same cause hypothesis has failed twice — the same command failing with the same
error twice qualifies with no judgment needed — stop before the third fix attempt.
Write the hypothesis and its refuting evidence as one line in the progress log. If the
hypothesis still stands after writing that line, pick one:

- **Insert a research card in front** — use the "When You Must Leave the Card" procedure
  above so split creates it and adds it to the current card's Depends. A minimal
  reproduction is the deliverable
- **A clean-context diagnosis** — hand over only the card (Progress log section
  excluded) and the failure evidence, and receive a cause diagnosis. A failed
  hypothesis blinding the eyes is what causes stuckness.

A delegated implementer stops and reports blocked — both exits belong to the main session.

## Delegating to Subagents

- **The card defines the work unit.** The briefing is exactly the card path + canonical
  rules path + `devflow/project/product.md` + `devflow/project/arch.md` +
  `devflow/project/code-style.md` + the existing `devflow/project/design.md` + the existing
  `devflow/project/glossary.md` and `devflow/journal.md` + every direct dependency-card
  path + the automatically selected capability document and Binding ADR paths + the carry-
  line query output + the design
  and verification freshness and reconfirmation projection. Give no other conversation
  backstory. After reading the card, the delegate opens
  its `Read first` paths exactly. Never put arch section names in `Read first`. For T-low
  tier, first check the card's `Read first` is complete; reinforce it if not.
- **The stage split is fixed: subagent = implement + run the completion signal + progress
  log. Main = review + commit + feedback + rename (plus the signal re-run triggered by
  its own fix).** Checkpoint commits are the main
  session's too — a subagent's protection is its log (if it dies, main redispatches).
- **Return is fixed at 5 lines:** status (done/blocked) · changed files · completion-signal
  result · learned · open. Details go straight into the progress log by the subagent
  itself. The main session takes only the 5 lines.
- On failure, the canonical rules' failure ladder. Never re-dispatch the same prompt.

## Parallel Delegation — several subagents inside one session

This section covers only one session dispatching several subagents at once — sessions in
the same folder each carrying their own card are the canon's "Several hands in one
working folder" and need no approval. Parallel delegation runs only when approved in
split's execution proposal. Same conditions as split:
only tasks that don't overlap in files AND don't touch a shared dev server. Frontend
work sharing a dev server is sequential.

## Handoff Trigger — events, not percentages

**You cannot observe your own context usage.** A rule hung on a percentage is a rule you
guess at and get wrong. The user sees the gauge; your triggers are events you CAN observe:

```
Before opening a new capability folder     → state the size of the next step and ask the
                                             user (the biggest single commitment in the tree)
Before a long card · at checkpoint commits → report the context concern and the next
                                             step's size. Do not wait for a reply
When the harness warns about context       → whatever the number, open no new task.
                                             Prepare handoff at the boundary
```

Handoff happens **only at task boundaries**. Never mid-task — half-written code and a
half-true explanation get handed over. Mid-task safety belongs to the loop's log gate,
not to a handoff document.

Before writing HANDOFF, check: did this session's conversation produce anything that
matches a row of the discovery→update table but is not yet in that document? If so,
land it through the table first — HANDOFF carries only the volatile remainder. Nothing
to land is the normal case — if you landed things as they happened, this check is empty.

My room's `devflow/users/<my id>/HANDOFF.md` — overwritten
every time. **No position, no progress percentages** (the tree answers those). Volatile
context only:

```markdown
# HANDOFF · <YYYY-MM-DDTHH:MM:SSZ>
## Next single step          <!-- one tree path | none -->
```

`Next single step` is mandatory and holds one tree path — the one the canonical candidate
order would take next. Write `none` only when the tree has no pending and no claimed card
at all. Add no other section to this file, so that when two sessions of one room overwrite
each other, the only thing lost is a value that is recomputed. Anything else this session
learned lands durably instead — the card's carry line inside this unit, a journal
`capability note` about another capability, an attributed journal line for an open item a
person must decide.

The first time this room's HANDOFF still carries a `## Just learned`, `## Traps`, or
`## Open decisions` section,
land that content before overwriting: through the discovery→update table where a row takes it, as a
`capability note` where it belongs to another capability, in this card's carry line
where it belongs to this one, and as an attributed journal line where a person must decide
it. Overwrite only after that landing. Do not backfill carry lines
onto older `.done.` cards.

HANDOFF and journal are main-session-only.
