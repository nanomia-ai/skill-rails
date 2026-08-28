# authoring card — evidence-credit

Purpose: route one work or verify intent through shared canon and one selected stage reference without crediting remembered proof.
Failure scene: an unavailable verifier blocks prose work, or a pass claim is accepted without matching current identities and reobservation.
Observations: decided intent token; raw channel, task, snapshot, selection, continuation, verdict, currentness, and recorded JSON facts.
Terminals: work reports DONE; unavailable channel WAIT; missing result NEXT after projected effects; finding, stale, mismatch, or inaccessible proof BLOCK; matching pass DONE.
Guards: work prose restricts verifier acquisition, dispatch, and writes; runtime snapshot staleness and missing observations fail closed in the frozen runtime.
Stages: work, channel, acquire, evidence.
Effects: the acquire stage alone projects channel acquisition, verifier dispatch, and result recording in order; other stages report or stop.
Passengers: rich work and verify judgment stay in references; shared Failure Ladder and Status Notation stay in canon.
Artifacts: `state/verifier-result.log` records the exact one-line verifier result when the host performs the projected write.
Templates: `templates/lane-report.md` reports a status, one selected reference, and evidence.
Ownership: `spec.mjs` owns repeated behavior; references own judgment; collectors emit raw facts; the runtime calculates but performs no domain effect.
Deferred: none; cold host behavior and harness-observed effect adherence remain explicitly unproven outside this package pilot.
