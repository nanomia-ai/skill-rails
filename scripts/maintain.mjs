#!/usr/bin/env node
import { resolve } from "node:path";
import { parseArgs, requireArg } from "./lib/args.mjs";
import { exists, readJson } from "./lib/io.mjs";

try {
  const args = parseArgs(process.argv.slice(2), { booleans: ["repair-generated", "json", "diagnose"], values: ["skill", "query", "change", "repeats"] });
  const skill = resolve(requireArg(args, "skill"));
  if (!await exists(`${skill}/spec.mjs`)) throw new Error("SR_MAINTAIN_P2_ONLY: maintain.mjs operates on P2 packages; edit P0/P1 canonical sources directly, then lint and forward-test them.");
  if (args.diagnose) {
    const [{ diagnoseContract }, { snapshotContract }] = await Promise.all([import("./lib/maintenance.mjs"), import("./lib/semantic-diff.mjs")]);
    const value = diagnoseContract(await snapshotContract(skill), args.query ?? null);
    process.stdout.write(`${JSON.stringify({ ok: true, ...value }, null, 2)}\n`);
  } else {
    const { maintainPackage } = await import("./lib/maintenance.mjs");
    const change = await readJson(requireArg(args, "change"));
    const report = await maintainPackage(skill, change, { repairGenerated: Boolean(args["repair-generated"]), repeats: Number(args.repeats ?? 200) });
    process.stdout.write(`${JSON.stringify({ ok: true, report }, null, 2)}\n`);
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
