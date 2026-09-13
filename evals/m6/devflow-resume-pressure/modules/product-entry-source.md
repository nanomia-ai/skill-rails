---
name: product
description: Service-planning interview. Defines the problem, capability composition, and boundaries of a new project, producing devflow/project/product.md. Use when starting a new project, planning a service, defining a product, or deciding MVP scope.
---

# product — Service Planning

First read all of the canonical rules (`../principles/SKILL.md`) and the planning evidence
discipline (`../principles/planning-evidence.md`). If present, read all of `devflow/journal.md`,
`devflow/project/product.md`, and `devflow/project/glossary.md`.
Read the existing `devflow/project/arch.md` only when choosing the next stage after a
re-run.

When `product re-run pending` lines exist, order them by timestamp and then journal line
order, decode each `statement-json` as a JSON string, and present the disproved source
text in this interview. Report as an integrity anomaly a line that begins with that
prefix but does not have the exact format or decode as a JSON string. Do not guess from
or delete that line, and do not start the re-run until the user confirms the source text
again. Repair follows the canonical integrity check's item-12 recovery.

Purpose: complete the service plan through an interview with the user, producing
`devflow/project/product.md`.
This stage is **service** planning — "not entertained" means product generates no
development questions (stack, DB, framework, architecture). A development choice the user
confirms first is not something to refuse but something to hand over — leave the choice and
the reason it was chosen as one attributed journal line, say "arch confirms it" in one line,
and return to the product questions. arch harvests that line before taking confirmation on
arch.md. It does not enter product.md.

## The Six Judgments (= the table of contents of product.md)

| Judgment | Question |
|---|---|
| Problem | Who suffers, because of what, and how badly |
| Approach | Why this approach. Which approaches were discarded. **Which goal wins when two collide** |
| Capability composition | What chunks (capabilities) are needed to solve this problem |
| Boundary | How far does the MVP go. What will **not** be built |
| Success criteria | What counts as success — stated verifiably, always |
| Screens & access points | Where do users reach the service |

## Question Frontier and Fact Confirmation

Before asking the user, use the planning evidence discipline to divide the current
frontier's unknowns into four kinds. First settle current repository facts, external
contract facts, and execution facts through the discipline's source and direct/isolated
research branches. Do not turn a fact into a question when its result affects no option.
For a blocking fact that is `conflicted` or `unavailable`, report the conflict or absence
and the decision that would change, then stop that dependent frontier.

When the user explicitly requests research, research only the requested scope regardless
of its impact on the current decision. If it is not a blocking fact, answer with the result
and continue the original frontier. Run automatic research only when one possible result
of a fact not yet `settled` would remove or add a current candidate, or change a recommended
default, Layer 0 field, or verifiability. product's automatic fact confirmation does not
decide the stack or DB. Both choices belong to arch.

- In one frontier, batch questions that do not change one another's necessity, options,
  or recommended defaults — usually 3–5, and no more than 5.
- When one option changes a later question, ask that one dependent question first.
- After free-form user input, recompute remaining dependencies and recommended defaults
  from the actual answer.
- Before creating the next frontier after applying an answer, and before final confirmation,
  run the planning evidence discipline's pre-commitment review. With no candidate, produce
  no additional output or question.
- At the same two points, write the confirmed reason and the discarded alternative into the
  product.md section that owns that conclusion — `Approach` carries why this approach and
  each discarded one, `Boundary` carries what will not be built and why. When the ground is
  a number, attach the execution conditions under which it is true and the command that
  measures it again in the same place. Immediately before confirming product.md, enumerate
  one by one the reasons this run confirmed that are not yet in the document and confirm
  each with the user — after confirmation there is no canonical route back to that
  conversation.

**Capability composition is the heart.** The capability names chosen here become the
module names in the architecture and the folder names in the task tree — the same words,
followed to the very end.

## Interview Rules

- **Attach my default (recommendation) to every question.** State explicitly:
  "unanswered items proceed with the default."
- Scale rounds actively to scope:
  - 1–3 capabilities → 1–2 rounds. Shallow. Over-questioning is itself waste
  - 4–7 capabilities → 3 rounds. Dig into each capability
  - 8+ capabilities → stop, say "this is not one project," and propose a split
- For every capability, always ask exactly one question: **"If this capability is removed
  from the MVP, can every success criterion still pass?"** If yes → MVP-exclusion candidate.
- When the target round budget is exhausted and the interview continues, summarize the
  confirmed content and remaining questions once in the conversation. This summary creates
  no file, state, or commit.

## Meaning Density

Create no new repeated format; combine existing homes. `Problem` owns the current state to
change, `Approach` owns the choice, its reason, and discarded approaches, and `Success
criteria` owns the desired observable result. A capability line contains its number, name,
user outcome, and why that outcome is needed for success exactly once. Do not duplicate the
same Why across identity, Boundary, and cards.

## Output — devflow/project/product.md

```markdown
# <service name>

<identity paragraph — exactly this form. This paragraph gets copied into every task card>
This service solves <problem> that <who> suffers because of <what>, by <approach>.
When it succeeds, <what> becomes possible.

## Problem
## Approach            <!-- include 1 line per discarded approach. 1-3 lines of priority when goals collide -->
## Capabilities        <!-- ① ② ③ number + name + user outcome + why that outcome is needed for success -->
## Boundary            <!-- MVP scope / will-not-build (explicit) -->
## Success criteria    <!-- 3–7 verifiable acceptance criteria -->
## Screens & access points   <!-- list of screens or interfaces -->
## Open questions

interface: web | desktop | cli | server-only | tui | mixed
```

Create alongside it: `devflow/project/glossary.md` — project terms fixed during the
interview, one `term: definition` line each.

When a confirmed product.md exists and only glossary.md is missing, do not repeat the
interview or modify product.md. Copy terms whose meanings product.md already fixes, ask
one question batch only for terms that lack definitions, and create only glossary.md.

The capability list is append-only — a retired row keeps its place, rows are never deleted
or reordered, and additions go at the end of the list. The number of a capability not yet
holding one on disk is derived from that position (the canonical rules' status notation).

When a capability retires during maintenance, do not delete it from the list — leave one
line: `④ ~~name~~ — retired (date, evidence pointer)` (numbers are immutable
identifiers). The capability's tree folder gets `.stale` (the canonical rules' status
notation). If the capability is still a waiting file, give that file `.stale.md` instead.
Under `Brownfield: no`, when a retired capability has no tree representation, create its
`.stale.md` waiting file in the same retirement commit.
When a brownfield has no tree representation for it, create none. Leave the baseline file
in place; the next capability-design refresh reports registered consumers from the retired
file's stored Scope paths.

**Before** asking the user to confirm the retirement, run the canonical rules'
**retirement observation gate** — its enumeration, its question, and its same-commit
landing live in the canon and are not restated here.

## Gates

- If a success criterion is not verifiable as written, it does not pass. Ask again.
- Immediately after the user confirms product.md, or glossary.md created alongside it,
  land it in the canonical Layer 0 commit; a run grounded by `product re-run pending` uses
  the binding-decision commit below instead.
- When this run was grounded by `product re-run pending` journal lines, after the user
  confirms the identity paragraph, Capabilities, Boundary, and success criteria, perform
  every action in the canonical discovery→update row that matches each change. Put the
  product.md change, every status rename and marker required by those rows, and deletion
  of the lines addressed by this run in one binding-decision commit. If interrupted before
  that commit, delete no pending line. Leave any line this run did not address.
- After the first creation, one line — "next is arch." For every re-run, first compare the
  confirmed changes with arch's Components, Stack, Code structure, Data, and verify_channel.
  If any confirmed change contradicts a current statement there, say "next is arch." If arch
  retains `Brownfield: yes`, adopt refreshes only the capability design zones after that run.
  When there is no contradiction but the capability list, a capability name, or a capability
  boundary changed, direct the next stage to adopt's capability-design refresh with
  `Brownfield: yes`, and to arch's with `Brownfield: no`. Those two refreshes repeat neither
  the Layer 0 interview nor reverse-derivation. Otherwise, if a tree exists say "next is
  resume"; if no tree exists, say "next is split."
