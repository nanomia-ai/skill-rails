import { fail } from "./diagnostics.mjs";

const HEX40 = /^[0-9a-f]{40}$/;
const CARD_NUMBER = /^\d{2}(?:\.\d+)+$/;
const CARD_LIST = /^\d{2}(?:\.\d+)+(?:\+\d{2}(?:\.\d+)+)*$/;
const PATH_VALUE = /^(?![./]*$)(?!.*(?:^|\/)\.\.(?:\/|$))(?!\s)(?!.*\s$)(?:[^\r\n;\s]| )+$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

export const NAMED_DOMAINS = Object.freeze([
  "integer",
  "hex40",
  "card-number",
  "card-list",
  "path",
  "text",
  "json"
]);

export function describeDomain(domain) {
  return typeof domain === "string" ? domain : JSON.stringify(domain);
}

export function parseListDomain(domain) {
  if (typeof domain !== "string") return null;
  const scalar = /^list:\[([^{}]+)\]$/.exec(domain);
  if (scalar) return { kind: "scalar-list", values: scalar[1].split("|") };
  if (domain.startsWith("list:[{") && domain.endsWith("}]") ) {
    return { kind: "object-list", unsupportedInlineShape: true };
  }
  return null;
}

export function isValidDomainDeclaration(domain) {
  if (Array.isArray(domain)) return domain.length > 0 && domain.every((value) => typeof value === "string");
  if (domain && typeof domain === "object") {
    return !Array.isArray(domain) && Object.keys(domain).length > 0 && Object.values(domain).every(isValidDomainDeclaration);
  }
  if (typeof domain !== "string") return false;
  if (NAMED_DOMAINS.includes(domain)) return true;
  if (domain.endsWith("|NONE")) return isValidDomainDeclaration(domain.slice(0, -5));
  const parsed = parseListDomain(domain);
  return parsed?.kind === "scalar-list" && parsed.values.every(Boolean);
}

export function isOpenDomain(domain) {
  return domain === "text";
}

export function validateDomainValue(domain, value) {
  if (value && value.__skillRailsUnknown === true) return { ok: true, unknown: true };
  if (Array.isArray(domain)) return { ok: typeof value === "string" && domain.includes(value) };
  if (domain && typeof domain === "object") {
    if (value === "NONE") return { ok: true };
    if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false };
    const expected = Object.keys(domain).sort();
    const actual = Object.keys(value).sort();
    if (expected.length !== actual.length || expected.some((key, index) => key !== actual[index])) return { ok: false };
    for (const key of expected) {
      if (!validateDomainValue(domain[key], value[key]).ok) return { ok: false, field: key };
    }
    return { ok: true };
  }
  if (typeof domain !== "string") return { ok: false };
  if (domain.endsWith("|NONE")) {
    if (value === "NONE") return { ok: true };
    return validateDomainValue(domain.slice(0, -5), value);
  }
  const list = parseListDomain(domain);
  if (list?.kind === "scalar-list") {
    return { ok: Array.isArray(value) && value.every((item) => typeof item === "string" && list.values.includes(item)) };
  }
  switch (domain) {
    case "integer": return { ok: Number.isInteger(value) && value >= 0 };
    case "hex40": return { ok: typeof value === "string" && HEX40.test(value) };
    case "card-number": return { ok: typeof value === "string" && CARD_NUMBER.test(value) };
    case "card-list": return { ok: typeof value === "string" && CARD_LIST.test(value) };
    case "path": return { ok: typeof value === "string" && PATH_VALUE.test(value) };
    case "text": return { ok: typeof value === "string" && !/[\r\n]/.test(value) };
    case "json": return { ok: isJsonValue(value) };
    default: return { ok: false };
  }
}

export function assertDomainValue(domain, value, pointer) {
  const result = validateDomainValue(domain, value);
  if (!result.ok) {
    fail("SR_DOMAIN_VALUE", `Value is outside domain ${describeDomain(domain)}`, {
      pointer,
      details: { value, nestedField: result.field ?? null }
    });
  }
  return value;
}

export function validateTimestamp(value) {
  return typeof value === "string" && TIMESTAMP.test(value) && !Number.isNaN(Date.parse(value));
}

function isJsonValue(value) {
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  return Boolean(value) && typeof value === "object" && Object.keys(value).every((key) => typeof key === "string") && Object.values(value).every(isJsonValue);
}
