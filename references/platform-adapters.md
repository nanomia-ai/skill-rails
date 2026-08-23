# Codex and Claude adapters

## Contents

- Portable core
- Codex
- Claude Code
- Support status

## Portable core

Keep portable `name` and `description` in `SKILL.md`. Generate platform metadata from the canonical intent instead of manually maintaining divergent skill bodies.

Every script command uses an explicit `<skill-root>` placeholder. It means the directory containing the active `SKILL.md`, never the user's working project. The package does not require an installer or a shared runtime.

## Codex

Generate `agents/openai.yaml`. Codex exposes the skill's file path in its initial skill metadata; use that directory as `<skill-root>`. Test explicit `$skill-name` invocation, indirect triggering, near-miss non-triggering, absolute script invocation, read-only installed packages, and the `session / enter-hash` re-entry fallback after context loss.

Local discovery roots are `.agents/skills` from the current directory through the repository root, plus user and managed locations. Distribution through plugins is a later concern, not part of this creator's v0 install scope.

## Claude Code

Use the same portable skill package. Claude Code officially substitutes `${CLAUDE_SKILL_DIR}` inside skill content; use it as `<skill-root>`. Project skills live at `.claude/skills/<name>/SKILL.md`, personal skills at `~/.claude/skills/<name>/SKILL.md`, and plugin skills under `<plugin>/skills/`.

Do not add Claude-only frontmatter to the portable core unless a requested feature requires it. H1 SessionStart/compact recovery may restore the current `enter` projection but does not raise enforcement assurance. H2 PreToolUse interception is outside the initial product.

## Support status

- `verified`: a real integration test passed.
- `buildable-unverified`: artifacts build but no current execution evidence exists.
- `degraded`: a documented fallback loses a capability.
- `unsupported`: the target cannot preserve semantics.

Never silently drop a platform-specific capability.

Current implementation status:

- Portable package build and absolute runtime invocation: `verified` by local integration tests.
- Codex project-local discovery plus explicit and implicit invocation: `verified` by clean cold-agent runs. One installed near-miss also did not trigger. Long-session re-entry remains `unproven`.
- Claude Code project-local discovery, `${CLAUDE_SKILL_DIR}` use, plus explicit and implicit invocation: `verified` by clean cold-agent runs. Installed near-miss behavior and compaction recovery remain `unproven`.
- Cross-consumption: a Claude-created P1 package ran in Codex and a Codex-created P2 package ran in Claude without translation; copied trees were byte-identical.
- H1 recovery hook: `unsupported` in the current generated artifact; the Decision/enter-hash fallback remains available.
- H2 effect interception: `unsupported` and explicitly future scope.
