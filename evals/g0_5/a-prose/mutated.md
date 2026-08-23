# Review flow

The completion signal must pass before review. If it has not passed, run the completion check, write its evidence record, and re-enter the flow.

In a read-only session, do not write or dispatch. A plan that requires either action is blocked before it is shown.

## Review table

Read the following rows from top to bottom and use the first matching row:

1. If the latest review does not find a code defect, dispatch a clean reviewer after repair and write the review result.
2. If the third or later code finding has no human disposition, ask the human and stop.
3. If the latest review finds a card-contract defect, route to planning and stop.
4. If the latest review is unverified, block with its reason.
5. If the latest review passes but its result has not been recorded, write the review result and re-enter.
6. If there is no review, dispatch a clean reviewer and write the review result.

## Review record

Every review record has a timestamp, 40-character head, and verdict. The implementation flow writes the record; no later component reads it.

After a recorded pass, report completion and stop.
