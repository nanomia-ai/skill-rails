---
name: skill-rails-next
description: Create and maintain standalone AI skills from canonical source packages when deterministic build, provenance, bounded inspection, or behavior-versus-effect evidence is required. Do not use archived Skill Rails or Devflow as a template or fallback.
---

# Skill Rails Next

Build one standalone skill from a small canonical source graph while leaving genuine meaning judgments with the AI or user.

## Work from canonical source

- Change the source package, target, modules, domain adapter, or contract that owns the behavior. Never hand-edit a generated target carrying `.skill-rails-build.json`.
- Use exact IDs and paths. Do not infer requirement, check, effect, or causal relationships that the source graph does not declare.
- Treat missing behavioral or host evidence as `unproven`; build and integrity checks prove delivery only.
- Do not import archived Skill Rails or Devflow as an implementation baseline, compatibility layer, or runtime fallback.

## Repository operations

In a Skill Rails Next source repository:

1. Inspect a known node with `node src/core/cli.mjs inspect --source <manifest> --id <exact-id> --json` or the exact `--path` form.
2. Build all targets with `node src/core/cli.mjs build --source <manifest> --out-root <dist-root>`, or one target with the documented `--target` and `--out` form.
3. Check artifact integrity separately from source currentness. Neither check establishes fresh-agent behavior or external effect.

This alpha entry covers the source/build boundary. Runtime adoption and broader authoring guidance remain gated by the recorded pilot evidence.
