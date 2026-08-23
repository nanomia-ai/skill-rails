#!/usr/bin/env node
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "./lib/args.mjs";
import { exists } from "./lib/io.mjs";
import { lintSimpleSkill } from "./lib/simple-lint.mjs";

try {
  const args = parseArgs(process.argv.slice(2), { booleans: ["self", "repair-generated", "json"], values: ["skill", "repeats"] });
  const root = resolve(args.skill ?? (args.self ? fileURLToPath(new URL("..", import.meta.url)) : process.cwd()));
  let result;
  if (await exists(`${root}/spec.mjs`)) {
    const { buildP2 } = await import("./lib/build-core.mjs");
    result = { ok: true, ...await buildP2(root, { allowGeneratedEdits: Boolean(args["repair-generated"]), repeats: Number(args.repeats ?? 200) }) };
  }
  else {
    const validation = await lintSimpleSkill(root, { creatorBudgets: Boolean(args.self) });
    if (!validation.ok) throw new Error(validation.diagnostics.map((item) => `${item.code}: ${item.message}`).join("\n"));
    result = { ok: true, root, profile: args.self ? "p1-creator" : "p0-or-p1", validation };
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
