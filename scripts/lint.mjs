#!/usr/bin/env node
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "./lib/args.mjs";
import { exists } from "./lib/io.mjs";
import { lintSimpleSkill } from "./lib/simple-lint.mjs";

let args;
try {
  args = parseArgs(process.argv.slice(2), { booleans: ["self", "fast", "full", "json"], values: ["skill", "lang"] });
  const root = resolve(args.skill ?? (args.self ? fileURLToPath(new URL("..", import.meta.url)) : process.cwd()));
  const p2 = await exists(`${root}/spec.mjs`);
  let result;
  if (p2) {
    const { validateFast, validateFull } = await import("./runtime/validator.mjs");
    result = args.fast ? await validateFast(root) : await validateFull(root, { language: args.lang ?? "en" });
  } else result = await lintSimpleSkill(root, { creatorBudgets: Boolean(args.self) });
  if (args.json) process.stdout.write(`${JSON.stringify(serializableResult(result), null, 2)}\n`);
  else process.stdout.write(result.ok ? `${result.level}: pass\n` : `${result.diagnostics.map((item) => `${item.code} ${item.pointer}: ${item.message}`).join("\n")}\n`);
  process.exitCode = result.ok ? 0 : 1;
} catch (error) {
  const value = { ok: false, level: "lint", diagnostics: [{ code: error.code ?? "SR_LINT", pointer: error.pointer ?? null, message: error.message, hint: error.hint ?? null }] };
  if (args?.json) process.stdout.write(`${JSON.stringify(value, null, 2)}\n`); else process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}

function serializableResult(result) {
  return { ok: result.ok, level: result.level, diagnostics: result.diagnostics, checks: result.checks ?? null, spec: result.spec ? { SPEC: result.spec.SPEC } : null, analysis: result.analysis ? { exports: result.analysis.exports, imports: result.analysis.imports, predicateReads: result.analysis.predicateReads, callGraph: result.analysis.callGraph } : null };
}
