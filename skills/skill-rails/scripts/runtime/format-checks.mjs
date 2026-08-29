import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export async function validateFormatFixtures(skillRoot, spec) {
  const diagnostics = [];
  const formats = Object.keys(spec.FORMATS ?? {});
  const path = join(resolve(skillRoot), "fixtures", "formats.json");
  let fixtures;
  try { fixtures = JSON.parse(await readFile(path, "utf8")); }
  catch (error) {
    if (formats.length === 0) return diagnostics;
    return [diag("fixtures/formats.json", `Every exact format requires a readable golden fixture file: ${error.message}`)];
  }
  if (!Array.isArray(fixtures)) return [diag("fixtures/formats.json", "Format fixtures must be an array.")];
  const seen = new Set();
  for (const fixture of fixtures) {
    const pointer = `fixtures/formats.json:${fixture?.id ?? "<missing>"}`;
    if (!fixture?.id || seen.has(fixture.id)) diagnostics.push(diag(pointer, "Format fixture id is missing or duplicated."));
    seen.add(fixture?.id);
    const format = spec.FORMATS?.[fixture?.format];
    if (!format) { diagnostics.push(diag(pointer, `Unknown format fixture target: ${fixture?.format}`)); continue; }
    const expectedFields = Object.keys(format.fields ?? {}).sort();
    const actualFields = Object.keys(fixture.values ?? {}).sort();
    if (expectedFields.join("\0") !== actualFields.join("\0")) diagnostics.push(diag(`${pointer}.values`, `Golden values must contain exactly the format fields. expected=${expectedFields.join(",")} actual=${actualFields.join(",")}`));
    const rendered = format.render(fixture.values ?? {}, fixture.context ?? {});
    if (typeof rendered !== "string" || rendered !== fixture.expect) diagnostics.push(diag(`${pointer}.expect`, `Golden rendering mismatch. expected=${JSON.stringify(fixture.expect)} actual=${JSON.stringify(rendered)}`));
    const parsed = typeof fixture.expect === "string" ? format.parse(fixture.expect) : { ok: false };
    if (!parsed.ok || JSON.stringify(parsed.fields) !== JSON.stringify(fixture.values ?? {})) diagnostics.push(diag(`${pointer}.expect`, "Golden format does not parse back to the declared values."));
  }
  for (const id of formats) if (!fixtures.some((fixture) => fixture?.format === id)) diagnostics.push(diag(`FORMATS.${id}`, "Exact format has no golden fixture."));
  return diagnostics;
}

function diag(pointer, message) { return { code: "L15", pointer, message, hint: null, level: "error" }; }
