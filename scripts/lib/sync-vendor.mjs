#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "../../skills/skill-rails/scripts/lib/args.mjs";

const args = parseArgs(process.argv.slice(2), { booleans: ["check"] });
const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const skillRoot = join(repoRoot, "skills", "skill-rails");
const packageRoot = join(repoRoot, "node_modules");
const bundleTarget = join(skillRoot, "scripts", "vendor", "markdown-it.cjs");
const licenseTarget = join(skillRoot, "scripts", "vendor", "MARKDOWN-IT-THIRD-PARTY-LICENSES");

try {
  const bundle = await readRequired(join(packageRoot, "markdown-it", "dist", "markdown-it.js"));
  const licenses = await renderLicenses(packageRoot);
  const expected = new Map([[bundleTarget, bundle], [licenseTarget, Buffer.from(licenses, "utf8")]]);
  if (args.check) {
    const stale = [];
    for (const [target, content] of expected) {
      let actual;
      try { actual = await readFile(target); }
      catch { stale.push(target); continue; }
      if (!actual.equals(content)) stale.push(target);
    }
    if (stale.length > 0) throw new Error(`SR_VENDOR_STALE: run npm run vendor:sync after npm ci; stale=${stale.map((path) => path.slice(skillRoot.length + 1).replaceAll("\\", "/")).join(",")}`);
  } else {
    for (const [target, content] of expected) {
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content);
    }
  }
  process.stdout.write(`${JSON.stringify({ ok: true, mode: args.check ? "check" : "sync", files: [...expected.keys()].map((path) => path.slice(skillRoot.length + 1).replaceAll("\\", "/")) })}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}

async function renderLicenses(base) {
  const packages = [
    ["markdown-it", "LICENSE"],
    ["entities", "LICENSE"],
    ["linkify-it", "LICENSE"],
    ["mdurl", "LICENSE"],
    ["punycode.js", "LICENSE-MIT.txt"],
    ["uc.micro", "LICENSE.txt"]
  ];
  const sections = ["Third-party notices for scripts/vendor/markdown-it.cjs", ""];
  for (const [name, licenseFile] of packages) {
    const metadata = JSON.parse((await readRequired(join(base, name, "package.json"))).toString("utf8"));
    const license = (await readRequired(join(base, name, licenseFile))).toString("utf8").trimEnd();
    sections.push(`===== ${name} ${metadata.version} =====`, "", license, "");
  }
  return `${sections.join("\n").trimEnd()}\n`;
}

async function readRequired(path) {
  try { return await readFile(path); }
  catch (error) { throw new Error(`SR_VENDOR_SOURCE_MISSING: run npm ci before syncing vendored dependencies: ${path}: ${error.message}`, { cause: error }); }
}
