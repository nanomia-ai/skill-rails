#!/usr/bin/env node
import { resolve } from "node:path";
import { parseArgs, requireArg } from "./lib/args.mjs";
import { readJson } from "./lib/io.mjs";
import { generatePackage } from "./lib/generator.mjs";

try {
  const args = parseArgs(process.argv.slice(2), { booleans: ["replace", "no-build", "json"], values: ["intent", "out", "profile", "repeats"] });
  const intent = await readJson(requireArg(args, "intent"));
  const result = await generatePackage({
    intent, output: resolve(requireArg(args, "out")), requestedProfile: args.profile ?? "auto", replace: Boolean(args.replace),
    finalize: args["no-build"] ? null : async (root, selection) => {
      if (selection.profile === "p2") {
        const { buildP2 } = await import("./lib/build-core.mjs");
        await buildP2(root, { repeats: Number(args.repeats ?? 200) });
      }
    }
  });
  process.stdout.write(`${JSON.stringify({ ok: true, ...result }, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
