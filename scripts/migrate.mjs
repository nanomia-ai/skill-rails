#!/usr/bin/env node
import { resolve } from "node:path";
import { parseArgs, requireArg } from "./lib/args.mjs";
import { exists, readJson } from "./lib/io.mjs";
import { generatePackage } from "./lib/generator.mjs";
import { inferMigrationIntent, inspectProseSkill, writeMigrationLedger } from "./lib/migration.mjs";

try {
  const args = parseArgs(process.argv.slice(2), { booleans: ["replace", "no-build", "json"], values: ["source", "out", "intent", "profile", "repeats"] });
  const source = resolve(requireArg(args, "source"));
  const output = resolve(requireArg(args, "out"));
  if (source === output) throw new Error("Migration output must differ from the read-only source.");
  const inspection = await inspectProseSkill(source);
  const intent = args.intent ? await readJson(args.intent) : await inferMigrationIntent(source, inspection);
  const result = await generatePackage({
    intent, output, requestedProfile: args.profile ?? "auto", replace: Boolean(args.replace),
    finalize: async (root, selection) => {
      await writeMigrationLedger(root, inspection);
      if (!args["no-build"] && selection.profile === "p2") {
        const { buildP2 } = await import("./lib/build-core.mjs");
        await buildP2(root, { repeats: Number(args.repeats ?? 200) });
      }
    }
  });
  process.stdout.write(`${JSON.stringify({ ok: true, ...result, migration: { source, atoms: inspection.atoms.length, critical_review_required: inspection.atoms.filter((item) => item.consequence === "high").length } }, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
