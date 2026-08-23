# Review flow

## why: purpose

Evidence must survive session loss so a later agent can distinguish completed review from a remembered claim.

## guard: read-only-session

Explain that the current session can inspect but cannot present a state-changing plan.

## stage: signal

Judgment: Diagnose failures in the completion result without inventing a pass.

Why: Review starts only from current execution evidence.

## stage: review

Judgment: Repair code findings; leave card-contract findings to planning.

Why: Code correction and contract correction have different owners.

## stage: route

Judgment: Summarize only the evidence already verified by the runtime.

Why: A completion report must not strengthen the evidence it cites.

## role: reviewer

Approach the supplied diff without implementation history. Judge intent, logic, scope, and contract fit from the provided inputs.
