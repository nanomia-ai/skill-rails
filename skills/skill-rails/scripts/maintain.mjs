#!/usr/bin/env node
import { resolve } from "node:path";
import { parseArgs, requireArg } from "./lib/args.mjs";
import { exists, readJson } from "./lib/io.mjs";

try {
  const args = parseArgs(process.argv.slice(2), { booleans: ["repair-generated", "json", "diagnose", "describe", "map"], values: ["skill", "query", "change", "repeats"] });
  const skill = resolve(requireArg(args, "skill"));
  const hasChange = Object.hasOwn(args, "change");
  const modes = [Boolean(args.describe), Boolean(args.diagnose), hasChange].filter(Boolean).length;
  if (modes !== 1) throw new Error("Choose exactly one maintenance mode: --describe, --diagnose, or --change <file>.");
  if (args.map && !args.describe) throw new Error("--map requires --describe.");
  if (args.map && (Object.hasOwn(args, "json") || Object.hasOwn(args, "query"))) throw new Error("--map cannot be combined with --json or --query.");
  if (args.describe && (Object.hasOwn(args, "repair-generated") || Object.hasOwn(args, "repeats"))) throw new Error("--describe is read-only and does not accept --repair-generated or --repeats.");
  if (args.diagnose && (Object.hasOwn(args, "repair-generated") || Object.hasOwn(args, "repeats") || args.map)) throw new Error("--diagnose does not accept write or map options.");
  if (hasChange && (Object.hasOwn(args, "query") || args.map)) throw new Error("--change cannot be combined with --query or --map.");

  if (args.describe) {
    const { createMaintenanceContext, renderMaintenanceContextText, renderSkillMapPreview } = await import("./lib/maintenance-context.mjs");
    const value = await createMaintenanceContext(skill, { query: args.query ?? null });
    if (args.map) process.stdout.write(`${renderSkillMapPreview(value)}\n`);
    else if (args.json) process.stdout.write(`${JSON.stringify({ ok: true, ...value })}\n`);
    else process.stdout.write(renderMaintenanceContextText(value));
  } else if (args.diagnose) {
    if (!await exists(`${skill}/spec.mjs`)) throw new Error("SR_DIAGNOSE_P2_ONLY: semantic contract diagnosis applies to P2 packages only.");
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
