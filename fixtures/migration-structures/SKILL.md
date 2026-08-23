---
name: structured-source
description: Preserve structured Markdown obligations while migrating a skill.
allowed-tools: Read, Write
license: MIT
compatibility: Codex and Claude Code
disable-model-invocation: true
user-invocable: false
x-future-metadata: preserve exactly
---

# Release gate

Run the verification command and record its result.
The second sentence stays in this paragraph.

- Block publication when verification fails.
  Keep this continuation with the item.
  - Check the child evidence.
    Keep nested detail with the child.
- Publish only after verification passes.

## Decision matrix

| State | Action |
| --- | --- |
| verification fails | never publish |
| verification passes | publish report |

[release-policy]: https://example.test/release-policy

```sh
if verify; then
  echo "verified"
fi
```
