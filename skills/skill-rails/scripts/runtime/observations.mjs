import { UNKNOWN, isUnknown, unknown } from "./dsl.mjs";
import { validateDomainValue } from "./domains.mjs";
import { fail } from "./diagnostics.mjs";
import { sha256 } from "./hash.mjs";

export function canonicalizeObservationValue(value) {
  return value === "UNKNOWN" ? UNKNOWN : value;
}

export function normalizeObservationSet(spec, input, options = {}) {
  const supplied = flattenObservationInput(spec, input);
  const flat = {};
  const unknowns = [];
  const missingReason = options.missingReason ?? "fixture-missing";
  const pointerPrefix = options.pointerPrefix ?? "fixture.s";
  const valueLabel = options.valueLabel ?? "Fixture value";
  for (const [field, declaration] of Object.entries(spec.OBSERVATIONS ?? {})) {
    const raw = Object.hasOwn(supplied, field) ? supplied[field] : unknown(missingReason, field);
    const value = canonicalizeObservationValue(raw);
    const validation = validateDomainValue(declaration.domain, value);
    if (!validation.ok) fail("L3", `${valueLabel} is outside ${field}'s domain.`, { pointer: `${pointerPrefix}.${field}`, details: { value } });
    if (isUnknown(value)) unknowns.push({ field, reason: value.reason, details: value.details ?? null });
    flat[field] = value;
  }
  return { flat, nested: nestFlat(flat), unknowns };
}

export function bindObservationInputs(spec, input, kind, snapshotFingerprint, requireBinding = true) {
  const output = {};
  for (const [field, raw] of Object.entries(input ?? {})) {
    const declaration = spec.OBSERVATIONS?.[field];
    if (!declaration?.[kind]) fail("SR_INPUT_SOURCE", `${field} is not declared as ${kind}.`);
    const parsed = parseBoundValue(raw);
    if (requireBinding && parsed.snapshot && !snapshotFingerprint.startsWith(parsed.snapshot)) fail("SR_INPUT_STALE", `${kind} value for ${field} is bound to a different snapshot.`);
    const value = canonicalizeObservationValue(parsed.value);
    if (!validateDomainValue(declaration.domain, value).ok) fail("SR_INPUT_DOMAIN", `${kind} value for ${field} is outside its domain.`);
    output[field] = value;
  }
  return output;
}

export function prepareFixtureInputs(spec, fixture) {
  const snapshot = {
    fingerprint: fixture.snapshot ?? sha256({ fixture: fixture.id ?? fixture.s }),
    status: "stable"
  };
  const observed = flattenObservationInput(spec, fixture.s ?? {});
  for (const field of Object.keys(observed)) {
    const declaration = spec.OBSERVATIONS?.[field];
    if (declaration?.judged || declaration?.decided) {
      const lane = declaration.judged ? "judged" : "decided";
      fail("SR_INPUT_SOURCE", `${field} must be supplied through fixture.${lane}, not fixture.s.`);
    }
  }
  const judged = bindObservationInputs(spec, fixture.judged ?? {}, "judged", snapshot.fingerprint, false);
  const decided = bindObservationInputs(spec, fixture.decided ?? {}, "decided", snapshot.fingerprint, false);
  const observations = normalizeObservationSet(spec, { ...observed, ...judged, ...decided });
  return { observations, judged, decided, snapshot };
}

export function flattenObservationInput(spec, input) {
  const output = {};
  for (const field of Object.keys(spec.OBSERVATIONS ?? {})) {
    const direct = Object.hasOwn(input ?? {}, field);
    const nested = readNestedOwn(input, field.split("."));
    if (direct && nested.present && nested.value !== input[field]) fail("SR_INPUT_SOURCE", `Observation ${field} is supplied in both flat and nested form.`);
    if (direct) output[field] = input[field];
    else if (nested.present) output[field] = nested.value;
  }
  return output;
}

export function nestFlat(flat) {
  const root = {};
  for (const [path, value] of Object.entries(flat)) {
    const segments = path.split(".");
    let current = root;
    for (const segment of segments.slice(0, -1)) current = current[segment] ??= {};
    current[segments.at(-1)] = value;
  }
  return root;
}

function parseBoundValue(raw) {
  if (typeof raw !== "string") return { value: raw, snapshot: null };
  const binding = /^(.*)@(sha256:[0-9a-f]{8,64})$/.exec(raw);
  const valueText = binding ? binding[1] : raw;
  const snapshot = binding ? binding[2] : null;
  let value = valueText;
  if (/^\d+$/.test(valueText)) value = Number(valueText);
  else if (/^(?:\[|\{)/.test(valueText)) { try { value = JSON.parse(valueText); } catch { /* retain string */ } }
  return { value, snapshot };
}

function readNestedOwn(input, segments) {
  let current = input;
  for (const segment of segments) {
    if (!current || typeof current !== "object" || Array.isArray(current) || !Object.hasOwn(current, segment)) return { present: false, value: undefined };
    current = current[segment];
  }
  return { present: true, value: current };
}
