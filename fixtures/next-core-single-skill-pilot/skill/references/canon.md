# Shared canon

`<project>` is the working project directory whose state the collector observes: in this bounded fixture, it is the project root containing the `state/` directory; in real use, it is the repository root.

<a id="failure-ladder"></a>
## Failure ladder

Use this ladder only when a dispatched attempt fails because its task guidance was insufficient. Local fix iterations under the same hypothesis and review rounds are not ladder attempts. Completed work that later returns non-pass belongs to verification repair recurrence, not this count.

1. First failure: reinforce the task from the failure's causality—what failed, why, and what follows—then re-dispatch. Never re-dispatch the same prompt.
2. Second failure: raise the executor tier, or have the main session take the task directly.
3. Third failure: return to the human. There is no fourth attempt.

Do not combine this ladder with the verification recurrence count.

<a id="status-notation-judgment-core"></a>
## Status notation judgment core

Judge task state from the card filename suffix: no suffix is pending; `.wip-<owner>.` is in progress; bare `.wip.` is an ownerless integrity anomaly; `.done.` is complete; and `.stale.` is invalidated and excluded from active closure counts. Releasing a claim removes its whole work-in-progress suffix but preserves its progress log.

The claimed card's progress log is the only task-progress record. Journal and verification records may hold decisions, verdicts, and routing, but they do not directly change task or folder status. Record files carry no status suffix and are excluded from status judgment.

A task may become `.done.` only after its completion signal passes, its applicable review passes, and its commit lands. A non-capability folder closes only when it has at least one non-stale direct child and every such child is `.done.` A capability folder closes only after capability-layer verification passes.

Card base names and assigned numbers are immutable: do not renumber or reuse them.

<a id="evidence-credit-notation"></a>
## Evidence credit notation

- `PROVEN` names only the exact claim supported by current strong evidence.
- `UNPROVEN` means required evidence is missing or inaccessible; it is not success or failure.
- `NON-PASS` preserves a finding, stale identity, mismatch, or violated expectation without blocking unrelated prose lanes.
