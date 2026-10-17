---
name: skill-rails
description: Design, build, and maintain standalone AI skills from a canonical source package, with prose for judgment and declared tools for exact work, built deterministically into skill folders. Use when creating, changing, splitting, testing, or delivering an AI skill as a source package (`skill-package.json`), including starting a project's first one, or when a built skill's delivery or evidence is in question.
---
<!-- generated; do not edit; source: authoring/skill-rails/SKILL.source.md; receipt: .skill-rails-build.json -->

# Skill Rails

Design one standalone skill as a small canonical source package, and build it when the user asks. Prose carries what needs meaning and stays with the AI or user; tools you declare carry what can be decided exactly.

## The work cycle

```text
start or resume
 ├─ new package ──→ references/new-package.md: where the source goes, whether to keep maintenance documents, how the work will run
 └─ existing package ──→ read the project's recorded state
        │
        ▼
SOURCE  design and refine with the user, over as many passes as needed; nothing is built      § Author or change one target
        │  before a change is reported done or built
        ▼
REVIEW  of a change that alters what another AI decides or does      § Review before you conclude
        │  read it yourself as its user would and hold it to this skill
        │  a finding ──→ fix at the owner, then REVIEW again from the entry
        │  nothing left to fix, or no such change ──→ the change is done: report how it was reviewed, what that found, and which built copies stay behind
        │  the user asks to build or test                                § Build, test, and deliver when the user asks
        ▼
ROUTE   recorded? ── no ──→ references/delivery.md: user chooses among routes A–D ──→ record it
        │
        ▼
BUILD   source ──→ the standalone skill folder the route needs      references/build-and-test.md
        │  build or check returns ERROR ──→ stop and follow its nextAction
        │  when a test was asked
        ▼
TEST    put it in place on this machine by the route ──→ a fresh AI uses it
        │  the run falls short ──→ keep what it showed and resolve the cause at its owner; a source fix returns to SOURCE
        ▼
back to SOURCE: a later change is a source change; built and installed copies stay behind until they are rebuilt and put in place again, so say so
```

Join the cycle where the user is. When the user chooses or later asks for the recommended maintenance documents, set them up with `references/project-docs.md`. Before an authoring or maintenance judgment, read §§0–0.1 of `references/skillEvolutionMethod.md` (the method), choose any further sections from its routing table by the decision at hand, and set how deep to go with its §2; its generated `skillEvolutionMethod.index.json` only locates byte ranges and defines no meaning or task list.

## Work from canonical source

- Change the manifest, target descriptor, entry, module, reference, tool, or record file that owns the behavior, never generated output or runtime state; a folder carrying `.skill-rails-build.json` is generated and never hand-edited.
- Declare only the modules, references, tools, and record files a target actually uses. The build fails closed on unknown fields, undeclared paths, root escapes, and colliding outputs. Manifest paths are relative to the manifest, whose directory is the root every source path must stay inside; a descriptor's file paths are relative to that descriptor, and a record's declared inputs and output to the project; the closed schemas in `scripts/skill-rails-cli/contracts/` define the fields.
- Use exact IDs and paths. Do not infer requirement, check, effect, or causal relationships the source does not declare.
- Before you rely on an earlier reading of the source for a later decision, or report it as final, reread the source files it rested on and confirm it still holds; skip the reread only when those files have not changed since you read them. If a stale input or output invalidates an answer, reread current sources instead of transplanting the old answer.

## Author or change one target

1. Inspect before editing: when the package exists, query it or the target by exact ID with the CLI's `inspect` (*Repository operations*), then the owner you will change and its consumers. If a target actually reads, runs, or writes something it does not declare, add the declaration at its canonical owner.
2. State the user burden to remove, the meaning that must remain with the AI or user, the observable result, and what stays out of scope.
3. Choose the smallest form that delivers it and write it, with *Decide what a tool should own*, *Split the work*, and *Write prose another AI can act on*; give every purpose, rule, declaration, tool, and evidence claim one canonical owner.
4. When one target's prose hands an artifact, decision, recovery, cleanup, or next-actor responsibility to another target's actor, read each involved target's entry and confirm the receiving obligation is reachable from the receiver's own entry, its references, or an imported module; a shared import satisfies this only when that module itself states the obligation. Treat a hand-off that these texts do not state as absent rather than inferring it.
5. Review the change with *Review before you conclude*. A change that the review's *When* covers is not done until that review has run, however small the change looks; your report says how it was reviewed and what that found.

## Decide what a tool should own

A tool is a script you write into the source; the build ships it in the skill's `scripts/` folder, and the AI runs it rather than reading it. Give a step to a tool when its result can be decided exactly from inputs the tool can read or be given — files, git state, values the AI already holds — and getting it wrong would change what gets written, which step comes next, or whether the work is accepted. Keep in prose whatever needs meaning: purpose, which case applies, whether something is complete or good enough, whether an action is safe or permitted, trade-offs. When one step needs both, split it there: the AI makes the judgment and passes it to the tool, which does the exact remainder — totaling what the AI categorized, writing the status the AI decided. A tool is consistent, not infallible: it settles only what it checks.

Weigh what a tool removes against what it adds. It removes exact work the AI would otherwise do by hand — walking many files, counting, matching an exact form, minting IDs, checking a finished file against fixed rules — and the mistakes that work invites, whether likely or already seen: a wrong form, a missed item, a stale write, two copies of one rule drifting apart. It adds code to keep correct, a command to run, and failures the prose must route; any migration it imposes on people or existing files counts too, and tool convenience does not authorize changing a format they rely on, so agree such a migration with the user unless the request already covers it. The case grows with how many items, runs, and readers depend on the exact result and how costly a slip is — one run across thousands of files can justify a tool as well as a daily repetition can; it shrinks when the result is loose enough that a careful reader gets it right. A tool adds a ritual, not certainty, when the AI must restate a judgment to fill its input and gets back nothing it could not have produced itself.

For example: fixed-field state files handed between stages may gain one shared checker when an omission would mislead the next stage; free-form text with no fixed invariant needs none; a skill that totals fifty receipts gains a tool for the totals while the AI decides each receipt's category.

Declare a tool in the manifest's `tools` and list it in each target that ships it. A judged result that must land in a file others also edit, without losing their changes, may instead fit the target's core `record`. Before writing or changing a tool or a `record`, or the step that calls it, open `references/tools.md`.

## Split the work

Keep the entry the smallest complete always-read contract: the background and intent needed to interpret every branch; the purpose, use trigger, and operating boundary; rules every branch uses, or unconditional pointers to their canonical owners; current inputs; completion evidence; and, for each other file, the exact condition for opening it, decidable from the current task before opening it — a next action, a confirmed state, or a question asked, in the entry's own words; when the work runs in stages, the map of that flow comes first (*Write prose another AI can act on*). Use the frontmatter `description` to say what the skill does and which requests should start it, in users' words, with enough to tell it apart from neighboring skills; keep the workflow in the body.

Move a block into its own file when a run can tell from its current task or stage that it does not need the block yet — a stage's detail before that stage starts, the handling of a rare case — and the reading saved exceeds the navigation and rereading cost. Never put apart things that must be judged together, whatever their length.

Content only this target reads and owns is a target-owned reference, declared by target-relative path in the descriptor's `references` and delivered as `references/<file name>`. Content other targets read, or owned outside this target, is a package module imported by ID; when a second target needs a reference, promote it to a module and repoint its readers. The build copies a module into each consuming skill because every installed skill must work alone; context is spent when content is read, so a module read again through another skill in the same conversation is spent again. Keep the modules every consumer always reads complete but small, and move parts only some consumers need into a module they open when a step needs it.

Make separate skills for responsibilities that start independently — their own trigger, their own session, or a check that must be made apart from the work it checks, such as a review by a session that did not write it. Keep stages in one skill when they always run together in one sitting and none needs its own entry point or such a separate check, loading each stage's detail when that stage starts. A hand-off to another skill names that skill and the artifact it should find, never a path into its folder.

## Write prose another AI can act on

Give a fresh AI the destination, why it matters, and the criteria and boundaries for choosing its own route; a fixed sequence only where order, state, external effect, or approval changes the result; what must not happen by its nature and why, not as a closed list; and a wall a wrong turn will hit, whether a tool's check or a boundary a reviewer can test. A reader treats every listed step or item as a duty, drops some under load, and has nothing to reason from when its case is not listed.

Keep what one judgment needs — its purpose, criterion, boundary, and any example — together where that judgment is made, call each thing by one name throughout, and say what a word such as *this* or *as needed* points to. A reader cannot reliably assemble an intent from scattered mentions, reads two names as two things, and fills a vague word with its own guess.

Where a skill's own result can drift from its criteria — a document, a plan, a review — end its work by checking that result against those criteria before reporting it done: a tool where *Decide what a tool should own* gives one, a reread against the criteria for the rest. The wall belongs where the drift happens.

Lay out the whole before its parts. A reader takes a file in from the top, sometimes from its first screen alone, and keeps the order it can see. Wherever a file's parts make one whole — stages that follow, return, or resume in a later session, skills that hand work to one another, the steps of one procedure, parts that depend on each other — draw that whole in a short map before explaining any part: each part with the section or file that holds its rules, every check the work must pass, such as a review or a verification, as a part of its own, and each transition, a failed check's included, stating in words where it starts, what triggers it, and where it leads, so that no route depends on the placement of lines or arrows alone, since a reader takes a text drawing one line at a time. The sections then follow the map's order under the names it uses, so the map indexes them instead of summarizing beside them: each transition points to the section that owns its details and exceptions and never directs a move those conditions forbid, and a rule several parts share sits once, before them or where they point to it. A whole that fits in one short list needs no map beyond that list. An order spread through paragraphs is rebuilt differently by each reader, and the step at its end, usually the check, is the first one dropped.

Give each block the form its content asks of the reader — prose for purpose, reasons, and judgment; a numbered list only for an order that must hold; bullets for a set without order; a table for several things compared on the same attributes; a code block for a map, a template, or an exact form; and, for a long procedure whose place the reader must not lose, a checklist it copies into its own work and ticks off. One section holds one stage or one judgment, under a heading that says what it decides or does in the words the text uses elsewhere. Keep one convention for headings, labels, and emphasis across the package: the reader learns the layout from the first file it opens and looks for it in the next, and emphasis on everything marks nothing, so keep it for what changes behavior when missed. A file opened on a condition begins with one line saying what it owns and when it is read, and a long one lists its sections at the top, since a reader may preview only its top. A document the skill writes for a later reader takes its form the same way, given in the skill through the shapes below.

A reader copies what it sees more faithfully than what it is told, so wherever a shape repeats, show it:

```text
parallel kinds of one thing  → a block per kind, the same fields in each      none gets merged or dropped
a result that needs judgment → one example, with what in it is fixed marked   a small template
a result that must match     → the form itself, its fields and order fixed    a large template, or the tool that prints it
```

For instance, a skill with two modes gives each its own block, `## Review` and `## Fix`, instead of one paragraph that describes both; each has the same fields, such as *When*, *Produces*, and *Stops when*, whose names are that skill's own.

Apply §5, §§8.3–8.4, and §9 of `references/skillEvolutionMethod.md` before writing more at each of these moments: before turning guidance into a list of cases, before adding a rule, exception, or tool to patch a failure, when the same sentence needs a third fix, and when a review names no failure scene beyond "it could confuse".

## Review before you conclude

A draft drifts toward what was easiest to write, and its author reads it with intentions the next AI will not have. Review applies this skill's criteria again, as a wall, before you call a change done or build it.

- When: after a change that alters what another AI will decide or do — a new target, a changed criterion or boundary, a new or changed tool or the step that calls it, a moved file boundary. Spelling or wording that leaves targets, permissions, and behavior the same needs none; a path change that alters what is read, written, or run does.
- Read as its user, the method's reading test (§8.4): do this read yourself. Start from the changed target's canonical entry and follow its declared reading conditions, with only the inputs its using AI would have, and for one or two realistic tasks trace what the source tells that AI to do, skip, and leave unknown, crediting only what a line actually says, not what you meant. This read works on the source as written and needs no build or install; it is part of finishing the change, not the test the user asks for, so it runs even when the user asked for no build or test. Where the traced behavior departs from the intent, the source is missing a condition, a reason, or an owner.
- Hold it to this skill: check the change against *Decide what a tool should own*, *Split the work*, and *Write prose another AI can act on*, and across them for what no single section owns: two places that pull the same step different ways, or a sentence that stops what another requires.
- A finding names its place, the misreading or failure it leads to, and why; "it could confuse" without a scene is not a finding, and finding nothing is a valid result.
- Fix at the owner, not where the symptom showed: a missing condition goes to the step that needs it, a fact the reader got wrong may belong to a tool, and removing or clarifying beats adding a rule. After a fix, review again from the entry as above, because a fix can break text it did not touch, and stop when a pass finds nothing left to fix; when the same sentence needs a third fix, decide with method §9.2 what is missing instead of rewording it.
- Another reviewer: when the user asks, also give the review to another agent — a subagent, or one started through a coordinator the user runs. When a wrong change would be costly, or fixes keep failing on the same premise, recommend that in your report rather than starting one unasked. Brief it and weigh its findings as method §10 describes: the background and intent in full, never the result you expect or the problem you suspect; it traces the tasks from the source and inputs alone.
- Build validation and any development test a tool keeps are the walls for the exact parts; this review covers how the AI uses them. Neither replaces the test of the installed skill, which runs when the user asks.

## Build, test, and deliver when the user asks

A source package with no built folder is a complete result of authoring, refined with the user over as many passes as it needs. A request to change what the skill does is a source change, even when a built folder or installed copy exists. Building, and the testing and delivery that depend on it, start only when the user asks, never to finish a change; a build request covers the work requested with it and does not carry over to a later change unless the user made it a standing instruction. Until then every built or installed copy stays behind the source, so say so when a change makes it so, and what a build would prove stays `unproven`. A test uses the delivered skill, so a request to test settles the route first when none is recorded, then builds, carries that route out on this machine, and tests. Rebuild only the targets a change affects, and keep the records of failed checks and observations. Build and integrity checks prove only the properties they check, and source-currentness only when checked against the current source; missing behavioral or host evidence is `unproven`.

Open `references/build-and-test.md` before building, running `check`, testing, claiming delivery, or stating what evidence covers, and at an adoption or release decision. Open `references/delivery.md` before a build when the project records no route, and whenever the user wants to choose, change, or carry out a delivery route.

## Repository operations

The installed skill carries one closed authoring CLI. Set `<skill-root>` to the directory containing this `SKILL.md`, keep the working directory at the project root that holds the source package (the folder containing `source/` for a package started with this skill), and run `node "<skill-root>/scripts/skill-rails-cli/src/core/cli.mjs"` with no arguments, `help`, or `--help` to recover the current forms of inspect, overview, build, and check. Invalid command arguments return JSON with a task-specific `nextAction`. For a person's whole-package question, use overview only to generate the current non-authoritative view from that source package; do not save it as another source of truth.
