---
name: skill-rails
description: Create, migrate, maintain, diagnose, build, and evaluate drift-resistant AI-agent skills with the smallest sufficient P0/P1/P2 structure; current adapters support Codex and Claude Code. Use when a skill must convert growing prose rules into maintainable executable mechanics, preserve migration provenance, generate platform-ready packages, or test trigger and behavior reliability.
---

# Skill Rails

Treat the user's intent as authoritative and the generated package as the durable work surface. Do not hold migration or generation state only in conversation.

Before running a bundled script, resolve `<skill-root>` to the directory containing this `SKILL.md`. In Claude Code use `${CLAUDE_SKILL_DIR}`. In Codex use the absolute skill path supplied with the available-skill metadata. Do not resolve scripts relative to the user's working project.

1. Capture or update an intent brief from [intent-brief.json](templates/intent-brief.json); its eleven array keys are the input contract. Read [authoring-workflow.md](references/authoring-workflow.md) for creation or maintenance.
2. Choose the smallest sufficient profile: P0 for judgment-only guidance, P1 for deterministic helpers without stateful branching, or P2 for repeated guards, stages, ordered effects, exact formats, or evidence gates.
3. For P2 work, read [v5-contract.md](references/v5-contract.md). Keep `spec.mjs` as the only behavior source and keep judgment in `body.md`.
4. For prose conversion, read [migration.md](references/migration.md). Create the atom ledger before deleting or rewriting source meaning.
5. Generate with `node "<skill-root>/scripts/init.mjs" --intent <intent.json> --out <folder> [--profile auto|p0|p1|p2]` or migrate with `node "<skill-root>/scripts/migrate.mjs" --source <skill-folder> --out <folder>`. Treat generated P1/P2 output as a scaffold, not a finished skill.
6. Maintain an existing P2 package with `node "<skill-root>/scripts/maintain.mjs" --skill <folder> --change <change.json>`. Inspect the semantic impact report before accepting generated edits. P0/P1 maintenance remains direct canonical-source editing followed by lint and forward tests.
7. Replace every marked scaffold with approved user-specific behavior and tests. Resolve each `.skill-rails/obligation-ledger.json` atom to stable target and evidence locators; never clear the final P2 `DEFERRED` item while any atom remains `review-required`. Run `node "<skill-root>/scripts/lint.mjs" --skill <folder>` after every edit, then build P2 before execution.
8. Read [evaluation.md](references/evaluation.md) and run `node "<skill-root>/scripts/eval.mjs" --skill <folder>` before claiming behavior quality. Missing execution evidence is `unproven`, not success.
9. Read [platform-adapters.md](references/platform-adapters.md) when building or verifying Codex/Claude outputs.
10. When the user asks to create or revise a skill README, read [readme-authoring.md](references/readme-authoring.md) completely before drafting. Use it as a flexible quality guide, not a mandatory template. The user's audience, tone, emphasis, and exclusions take priority, and the README must not claim more than the implementation and evidence support. Do not create a README merely because the guide exists.

Never edit generated artifacts behind `.generated.json` by hand. Change their canonical source and rebuild. If validation, manifest verification, or the runtime tool fails, stop and report the exact diagnostic instead of reconstructing a decision from prose.
