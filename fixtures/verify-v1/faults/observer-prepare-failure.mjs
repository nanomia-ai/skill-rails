#!/usr/bin/env node
for await (const _chunk of process.stdin) {
  // Drain the complete request so the injected failure is deterministic.
}
process.stderr.write("EVALUATION_PREPARE_FAILURE\n");
process.exitCode = 91;
