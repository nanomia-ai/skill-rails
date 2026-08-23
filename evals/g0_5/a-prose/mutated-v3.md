# Review flow

The completion signal must pass before review. If it has not passed, run the completion check, write its evidence record, and re-enter the flow.

In a read-only session, do not write or dispatch. Block a plan that requires either action before presenting it.

## Review table

Read the following rows from top to bottom and use the first matching row.

1. Match: the latest review finds a code defect.
   Actions: dispatch a clean reviewer after repair and re-enter.
2. Match: the third or later code finding has no human disposition.
   Action: ask the human and stop.
3. Match: the latest review finds a card-contract defect.
   Action: route to planning and stop.
4. Match: the latest review is unverified.
   Action: block with its reason.
5. Match: the latest review passes but its result has not been recorded.
   Actions: write the review result and re-enter.
6. Match: there is no review.
   Actions: dispatch a clean reviewer, write the review result, and re-enter.

## Review record

Schema: timestamp, 40-character hexadecimal head and verdict (pass, finding, or unverified).
Declared consumer: no later component reads the record.

After a recorded pass, report completion and stop.
