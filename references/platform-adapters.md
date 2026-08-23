# Portable installation and platform adapters

## Contents

- Portable core
- Universal file-based installation
- Skill root
- Codex
- Claude Code
- Support status

## Portable core

Keep portable `name` and `description` in `SKILL.md`. Generate platform metadata from the canonical intent instead of manually maintaining divergent skill bodies. The creator and every generated skill remain one package; an installer may copy or symlink that package but does not become a runtime dependency.

Skill Rails requires Node.js 20 or newer. Normal installed-skill commands use Node built-ins and package-local code. The creator carries the parser needed for migration, so `init`, `migrate`, `maintain`, `lint`, `build`, and `eval --skill` do not require a separate `npm ci`. Repository development and the frozen self-evaluation corpus still use dev dependencies and begin with `npm ci`.

## Universal file-based installation

The repository root is one discoverable skill package. A file-based skills installer can place the same package in any host discovery path it supports:

```bash
npx skills@latest add nanomia-ai/skill-rails
```

The installer selects the target agent and whether to link or copy. It does not install Skill Rails runtime dependencies and must not rewrite the skill body. Treat installer discovery and placement as structural evidence only; actual triggering, script-root resolution, and task output remain `unproven` until exercised in that host.

The current `skills` 1.5.23 release requires Node.js 22.20 or newer even though Skill Rails itself runs on Node.js 20 or newer. On Node.js 20, use a manual project-local clone. Normal skill use no longer requires `npm ci` after either installation path.

The root package currently includes repository tests and design records because the installer treats a root `SKILL.md` directory as the package boundary. Those extra files are not part of the AI loading route and do not change the portable behavior, but they make the installed copy larger. Moving the canonical package into a nested distribution directory would be a separate repository-layout migration, not an installation hotfix.

Do not add a Claude plugin, marketplace manifest, hook, or platform-specific behavior copy merely to support this command. A managed marketplace channel is a separate distribution product and requires its own packaging, submission, update, and verification evidence.

## Skill root

Every script command uses an explicit `<skill-root>` placeholder. It means the directory containing the active `SKILL.md`, never the user's working project.

- Use the host-provided discovered skill path when one exists.
- In Codex, use the absolute skill path from the available-skill metadata.
- In Claude Code, use `${CLAUDE_SKILL_DIR}`.
- On another file-based host, resolve the active `SKILL.md` location before invoking a script.
- If the host exposes no stable location, stop instead of guessing from the current working directory.

## Codex

Generate `agents/openai.yaml`. Test explicit `$skill-name` invocation, indirect triggering, near-miss non-triggering, absolute script invocation, read-only installed packages, and the `session / enter-hash` re-entry fallback after context loss.

## Claude Code

Use the same portable skill package. Project skills live at `.claude/skills/<name>/SKILL.md`, personal skills at `~/.claude/skills/<name>/SKILL.md`, and plugin skills under `<plugin>/skills/`.

Do not add Claude-only frontmatter to the portable core unless a requested feature requires it. H1 SessionStart/compact recovery may restore the current `enter` projection but does not raise enforcement assurance. H2 PreToolUse interception is outside the product boundary.

## Support status

- `verified`: a real integration test passed.
- `buildable-unverified`: artifacts build but no current execution evidence exists.
- `degraded`: a documented fallback loses a capability.
- `unsupported`: the target cannot preserve semantics.

Never silently drop a platform-specific capability.

Current implementation status:

- Portable package build, package-local runtime dependencies, and absolute runtime invocation: `verified` by local integration tests.
- Codex project-local discovery plus explicit and implicit invocation: `verified` by clean cold-agent runs. One installed near-miss also did not trigger. Long-session re-entry remains `unproven`.
- Claude Code project-local discovery, `${CLAUDE_SKILL_DIR}` use, plus explicit and implicit invocation: `verified` by clean cold-agent runs. Installed near-miss behavior and compaction recovery remain `unproven`.
- Cross-consumption: a Claude-created P1 package ran in Codex and a Codex-created P2 package ran in Claude without translation; copied trees were byte-identical.
- Universal installer discovery, copy, and dependency-free installed migration: `verified` structurally on Windows with the GitHub remote package and `skills` 1.5.23. This does not upgrade target-host model behavior.
- Other installer-supported hosts: placement is structurally available; trigger behavior, skill-root handling, and task output are `unproven`.
- H1 recovery hook: `unsupported` in the current generated artifact; the Decision/enter-hash fallback remains available.
- H2 effect interception: `unsupported` and explicitly outside scope.
