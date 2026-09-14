#!/usr/bin/env node
import { resolve } from "node:path";
import { buildTargets, planTargetBuild } from "./build.mjs";
import { checkTarget } from "./check.mjs";
import { toResultError, fail } from "./errors.mjs";
import { buildHumanOverview } from "./human-overview.mjs";
import { inspectGraph } from "./inspect.mjs";
import { loadSourceGraph } from "./validate.mjs";

const SYNOPSIS = `Skill Rails authoring CLI

Usage:
  node <cli.mjs> <command> [options]

Commands:
  build    --source <manifest> --target <target-id> --out <target-dir>
  build    --source <manifest> --out-root <distribution-root>
  check    --out <target-dir>
  check    --source <manifest> --target <target-id> --out <target-dir>
  inspect  --source <manifest> (--id <exact-id> | --path <relative-path>) --json
  overview --source <manifest>

Invalid command arguments return JSON with a task-specific nextAction.
`;

function parse(argv) {
  const [command, ...rest] = argv;
  const values = {};
  for (let index = 0; index < rest.length;) {
    const key = rest[index];
    if (!key?.startsWith("--")) fail("ARGUMENT_INVALID", `Invalid argument near ${key ?? "<end>"}.`, "Use documented named arguments.");
    if (Object.hasOwn(values, key)) fail("ARGUMENT_INVALID", `Duplicate argument ${key}.`, "Pass each argument once.");
    if (key === "--json") { values[key] = true; index += 1; continue; }
    if (index + 1 >= rest.length || rest[index + 1].startsWith("--")) fail("ARGUMENT_INVALID", `${key} requires a value.`, "Provide one value for the argument.");
    values[key] = rest[index + 1];
    index += 2;
  }
  return { command, values };
}

function allow(values, allowed) {
  for (const key of Object.keys(values)) if (!allowed.includes(key)) fail("ARGUMENT_INVALID", `Unknown argument ${key}.`, "Remove arguments outside the command contract.");
}

async function main() {
  const { command, values } = parse(process.argv.slice(2));
  if (command === undefined || command === "help" || command === "--help") {
    allow(values, []);
    return { format: "text", markdown: SYNOPSIS };
  }
  if (command === "build") {
    allow(values, ["--source", "--target", "--out", "--out-root"]);
    if (!values["--source"]) fail("ARGUMENT_INVALID", "build requires --source.", "Provide the canonical source package manifest.");
    const single = Boolean(values["--target"] || values["--out"]);
    if (single !== Boolean(values["--target"] && values["--out"]) || (single && values["--out-root"]) || (!single && !values["--out-root"])) fail("ARGUMENT_INVALID", "Choose either --target with --out, or --out-root.", "Use one documented build form.");
    return buildTargets(await loadSourceGraph(values["--source"]), { target: values["--target"], out: values["--out"], outRoot: values["--out-root"] });
  }
  if (command === "check") {
    allow(values, ["--source", "--target", "--out"]);
    if (!values["--out"]) fail("ARGUMENT_INVALID", "check requires --out.", "Provide the exact generated target directory.");
    let plan;
    if (values["--source"] || values["--target"]) {
      if (!values["--source"] || !values["--target"]) fail("ARGUMENT_INVALID", "Source-current check requires both --source and --target.", "Provide both canonical source and exact targetId.");
      plan = await planTargetBuild(await loadSourceGraph(values["--source"]), values["--target"]);
    }
    return checkTarget(resolve(values["--out"]), plan);
  }
  if (command === "inspect") {
    allow(values, ["--source", "--id", "--path", "--json"]);
    if (!values["--source"] || Boolean(values["--id"]) === Boolean(values["--path"]) || values["--json"] !== true) fail("ARGUMENT_INVALID", "inspect requires --source, exactly one of --id/--path, and --json.", "Use the documented exact inspect form.");
    return inspectGraph(await loadSourceGraph(values["--source"]), { id: values["--id"], path: values["--path"] });
  }
  if (command === "overview") {
    allow(values, ["--source"]);
    if (!values["--source"]) fail("ARGUMENT_INVALID", "overview requires --source.", "Provide the canonical source package manifest.");
    return { format: "text", ...(await buildHumanOverview(await loadSourceGraph(values["--source"])))};
  }
  fail("ARGUMENT_INVALID", `Unknown command: ${command ?? "<none>"}.`, "Use build, check, inspect, or overview.");
}

try {
  const result = await main();
  process.stdout.write(result.format === "text" ? result.markdown : `${JSON.stringify(result)}\n`);
} catch (error) {
  process.stdout.write(`${JSON.stringify(toResultError(error))}\n`);
  process.exitCode = 1;
}
