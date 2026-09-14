---
name: skill-rails
description: Create and maintain standalone AI skills from canonical source packages when deterministic build, provenance, bounded inspection, or behavior-versus-effect evidence is required. Do not use archived Skill Rails or Devflow as a template or fallback.
---
<!-- generated; do not edit; source: authoring/skill-rails/SKILL.source.md; receipt: .skill-rails-build.json -->

# Skill Rails

Build one standalone skill from a small canonical source graph while leaving genuine meaning judgments with the AI or user.

Before making an authoring or maintenance judgment, read §§0–0.1 of `references/skillEvolutionMethod.md`. Use its routing table and the decision's uncertainty, reach, and reversal cost to choose any additional sections. The generated `references/skillEvolutionMethod.index.json` is only a byte-range navigation aid; it does not define meaning or a closed task taxonomy.

## Work from canonical source

- Change the source package, target, modules, domain adapter, or contract that owns the behavior. Never hand-edit a generated target carrying `.skill-rails-build.json`.
- Put domain meaning in one canonical domain source, never in generated output or runtime state.
- Declare only the source modules, imports, inputs, output, contracts, and mechanism files the target actually consumes. The build fails closed on unknown fields, undeclared paths, root escapes, and unsupported combinations.
- Use exact IDs and paths. Do not infer requirement, check, effect, or causal relationships that the source graph does not declare.
- Treat missing behavioral or host evidence as `unproven`; build and integrity checks prove delivery only.
- Do not import archived Skill Rails or Devflow as an implementation baseline, compatibility layer, or runtime fallback.

## Author or change one target

1. State the user burden to remove, the meaning that must remain with the AI or user, the observable result, and what stays out of scope.
2. Compare the smallest viable forms. Prefer a prose target when the work is primarily judgment or host action. Use `record-only` only when one declared output benefits from a deterministic renderer, basis recheck, lock, and reread authority. Do not adopt `prepare-record` or fallback as a new product path; those paths remain historical evaluation evidence.
3. Give every purpose, domain rule, input/output declaration, renderer, contract, and evidence claim one canonical owner. Add only the package manifest, target descriptor, entry, and mechanism files the chosen target actually consumes.
4. Keep the entry short: say when to use the target, name the current inputs and completion evidence, and point to exact commands or sources. Put reusable domain meaning in imported modules and deterministic format or safety work in the renderer/core instead of repeating either in the entry.
5. Inspect the package or target by exact ID before editing, then inspect the changed owner and its consumers. If the graph reports a gap, leave it explicit unless an observed maintenance failure justifies a new colocated edge.
6. Build one target first, review its receipt and generated diff, and verify deterministic delivery and currentness. Test from a standalone copy; an artifact or hash check does not prove that a fresh AI understood or used it.
7. At the adoption or release gate, run the smallest realistic fresh-use observation that can change the decision and reread the actual effect. Record `proven`, `failed`, and `unproven` separately; do not grow a matrix after the decision is already bounded.

When maintaining an existing package, edit the canonical owner rather than generated output, rebuild only affected targets, and preserve failed receipts. If a stale input or output invalidates an answer, reread current sources instead of transplanting the old answer. For a person's whole-package question, generate the current non-authoritative view from that source package; do not save it as another source of truth.

## Repository operations

The installed skill carries one closed authoring CLI. Set `<skill-root>` to the directory containing this `SKILL.md`, keep the working directory at the ordinary source project root, and run `node "<skill-root>/scripts/skill-rails-cli/src/core/cli.mjs"` with no arguments, `help`, or `--help` to recover the current minimum forms for inspect, overview, build, and check. Invalid command arguments return JSON with a task-specific `nextAction`.

Inspect the exact owner and consumers before editing, use overview only for a non-authoritative whole-package view, double-build and compare tree hashes, and check artifact integrity separately from source currentness. Neither check establishes fresh-agent behavior or external effect. Review the generated diff and build receipt before claiming delivery.

Current evidence covers deterministic source/build/currentness, one bounded record-only use path, five small pilot stage observations, one machine-level non-Devflow generalization, and one bounded installed author-to-two-target-to-maintain-to-unfamiliar-use observation. The embedded CLI closes mechanical out-of-repository delivery without a sibling repository, global runtime, or network call. The evolution method's navigation benefit, broad host behavior, authoring-process efficiency, and prose-relative total cost remain `unproven`; inspect the named receipts before extending those claims.
