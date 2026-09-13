#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const [sourceArgument, outputArgument] = process.argv.slice(2);
if (!sourceArgument || !outputArgument) throw new Error("Usage: materialize-control.mjs <canonical-baseline> <package-root>");

const source = resolve(sourceArgument);
const packageRoot = resolve(outputArgument);
const baseline = await readFile(source);
const prefix = Buffer.from("---\nname: natural-language-pilot-verify-next\ndescription: Verify the fixed bookmark-storage pilot and record a bounded result while preserving prior report bytes. Use only for the natural-language pilot fixture contract.\n---\n<!-- generated control; canonical baseline hash follows in .control-build.json -->\n\n", "utf8");
const skill = Buffer.concat([prefix, baseline]);
const destination = resolve(packageRoot, "skills", "natural-language-pilot-verify-next", "SKILL.md");
await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, skill);
const receipt = {
  schemaVersion: 1,
  targetId: "natural-language-pilot-verify-next",
  source: sourceArgument.replaceAll("\\", "/"),
  sourceSha256: sha256(baseline),
  artifactSha256: sha256(skill),
};
await writeFile(resolve(packageRoot, "skills", "natural-language-pilot-verify-next", ".control-build.json"), `${JSON.stringify(receipt)}\n`);
process.stdout.write(`${JSON.stringify(receipt)}\n`);
