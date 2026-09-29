---
name: skill-rails
description: Create and maintain standalone AI skills from canonical source packages when deterministic build, provenance, bounded inspection, or behavior-versus-effect evidence is required. Do not use archived Skill Rails or Devflow as a template or fallback.
---
<!-- generated; do not edit; source: authoring/skill-rails/SKILL.source.md; receipt: .skill-rails-build.json -->

# Skill Rails

Build one standalone skill from a small canonical source graph while leaving genuine meaning judgments with the AI or user.

Before making an authoring or maintenance judgment, read §§0–0.1 of `references/skillEvolutionMethod.md`. Use its routing table and the decision's uncertainty, reach, and reversal cost to choose any additional sections. The generated `references/skillEvolutionMethod.index.json` is only a byte-range navigation aid; it does not define meaning or a closed task taxonomy.

## Work from canonical source

- Change the source package, target, module, observer, renderer, or contract that owns the behavior. Never hand-edit a generated target carrying `.skill-rails-build.json`.
- When maintaining an existing package, rebuild only affected targets and preserve failed receipts.
- Put domain meaning in one canonical domain source, never in generated output or runtime state.
- Declare only the source modules, imports, references, inputs, output, contracts, and mechanism files the target actually consumes. The build fails closed on unknown fields, undeclared paths, root escapes, and unsupported combinations. Manifest paths are relative to the manifest, whose directory is the root every source path must stay inside; a descriptor's source-file paths are relative to that descriptor, and its declared inputs and output to the project; the closed schemas in `scripts/skill-rails-cli/contracts/` define the fields.
- Use exact IDs and paths. Do not infer requirement, check, effect, or causal relationships that the source graph does not declare.
- Treat missing behavioral or host evidence as `unproven`; build and integrity checks prove delivery only.
- Do not import archived Skill Rails or Devflow as an implementation baseline, compatibility layer, or runtime fallback.
- Before using a consequential semantic result as a premise for a later judgment or accepting it as final, reread the current canonical source owners it actually depended on and confirm the result still holds, unless you just read those same bytes. If a stale input or output invalidates an answer, reread current sources instead of transplanting the old answer.

## Author or change one target

1. State the user burden to remove, the meaning that must remain with the AI or user, the observable result, and what stays out of scope.
2. Compare the smallest viable forms. Prefer a prose target when the work is primarily judgment or host action. Use `record-only` only when one declared output benefits from a deterministic renderer, basis recheck, lock, and reread authority. Do not adopt `prepare-record` or fallback as a new product path; those paths remain historical evaluation evidence.
3. Give every purpose, domain rule, input/output declaration, renderer, contract, and evidence claim one canonical owner. Add only the package manifest, target descriptor, entry, imported modules, target-owned references, and mechanism files the chosen target actually consumes.
4. Keep the entry as the smallest complete always-read contract: state the essential background and intent needed to interpret every branch, the purpose, use trigger and operating boundary, common rules or unconditional pointers to their shared owners, current inputs, completion evidence, and the exact read condition for each optional module or reference. That condition must be decidable from the current task and declared inputs before opening it: name the next action, a confirmed state, or a question asked, in the entry's own words. A rule shared by multiple targets has one canonical module owner; every consuming entry points to it, unconditionally when every run needs it. Move other content to a whole file only when a real task can safely skip it and the saved reading exceeds navigation and rereading cost; never separate meanings that must be judged together. Content only this target reads and owns is a target-owned reference: declare its target-relative path in a prose descriptor's `references`; it is delivered as `references/<file name>`. Content that other targets read, or that is owned outside this target, is a package module imported by ID. When a second target needs a reference, promote it to a module and repoint its readers. Where the target has a renderer, put deterministic formatting and mechanically decidable safety checks in the renderer/core; keep semantic safety and permission judgments with the domain source, AI, or user.
5. Inspect the package or target by exact ID before editing, then inspect the changed owner and its consumers. If inspection finds an actual target input, output, import, reference, or mechanism that step 3 requires but the target does not declare, add the missing declaration at its canonical owner. When one target's prose hands an artifact, decision, recovery, cleanup, or next-actor responsibility to another target's actor, read each involved target's entry and confirm the receiving obligation is reachable from the receiver's own entry, its target-owned references, or an imported module; a shared import satisfies this only when that module itself states the obligation. Leave any other undeclared relation explicit. Add a new semantic relation only at its canonical owner and only after an observed maintenance failure shows that it is needed.
6. Build and test with `references/build-and-test.md`: open it before building, checking, testing, claiming delivery, or stating what current evidence covers or leaves `unproven`, and at any adoption or release gate.

## Write prose another AI can act on

Write prose a fresh AI can act on: the destination, why it matters, and the criteria and boundaries for choosing its own route; a fixed sequence only where order, state, external effect, or approval changes the result; what must not happen by its nature and why, not as a closed list; and a wall a wrong turn will hit, whether a check or a boundary a reviewer can test. A reader treats every listed step or item as a duty, drops some under load, and has nothing to reason from when its case is not listed. Where a result repeats a shape that still leaves room for judgment, give one example as a shape to judge from and mark what in it is fixed; a form the result must follow exactly is stated as that form, not as an example, and step 4 says where it lives. Apply §§8.2–8.3 and §9.2–9.3 of `references/skillEvolutionMethod.md` before writing more at each of these moments: before turning guidance into a list of cases, before adding a rule or exception to patch a failure, when the same sentence needs a third fix, and when a review names no failure scene beyond "it could confuse".

## Repository operations

The installed skill carries one closed authoring CLI. Set `<skill-root>` to the directory containing this `SKILL.md`, keep the working directory at the ordinary source project root, and run `node "<skill-root>/scripts/skill-rails-cli/src/core/cli.mjs"` with no arguments, `help`, or `--help` to recover the current minimum forms for inspect, overview, build, and check. Invalid command arguments return JSON with a task-specific `nextAction`.

For a person's whole-package question, use overview only to generate the current non-authoritative view from that source package; do not save it as another source of truth.
