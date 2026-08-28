import { assertDomainValue, isOpenDomain, isValidDomainDeclaration, validateTimestamp } from "./domains.mjs";
import { fail } from "./diagnostics.mjs";

export const UNKNOWN = Object.freeze({ __skillRailsUnknown: true, reason: "unknown" });
export const NONE = "NONE";

export function unknown(reason = "unknown", details = null) {
  return Object.freeze({ __skillRailsUnknown: true, reason, details });
}

export function isUnknown(value) {
  return Boolean(value && value.__skillRailsUnknown === true);
}

export function line(head, fields) {
  return createLineFormat("line", head, fields);
}

export function progressLine(head, fields) {
  return createLineFormat("progress-line", head, fields);
}

function createLineFormat(kind, head, fields) {
  if (typeof head !== "string" || head.length === 0 || /[\r\n:;]/.test(head)) {
    fail("SR_FORMAT_HEAD", "Format head must be a non-empty single-line label without ':' or ';'.");
  }
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
    fail("SR_FORMAT_FIELDS", "Format fields must be an ordered object.");
  }
  const entries = Object.entries(fields);
  for (const [name, domain] of entries) {
    if (!/^[a-zA-Z][a-zA-Z0-9-]*$/.test(name)) fail("SR_FORMAT_FIELD", `Invalid field name: ${name}`);
    if (!isValidDomainDeclaration(domain)) fail("SR_DOMAIN_DECLARATION", `Invalid domain for ${name}`);
  }
  const open = entries.filter(([, domain]) => isOpenDomain(domain));
  if (open.length > 1 || (open.length === 1 && entries.at(-1)?.[0] !== open[0][0])) {
    fail("SR_FORMAT_OPEN_FIELD", "An open text field may appear at most once and must be last.");
  }
  const format = {
    kind,
    head,
    fields: Object.freeze(Object.fromEntries(entries)),
    render(values, options = {}) {
      const timestamp = options.timestamp ?? values.timestamp ?? new Date().toISOString();
      if (!validateTimestamp(timestamp)) return unknown("invalid-timestamp", timestamp);
      const parts = [];
      for (const [name, domain] of entries) {
        if (!(name in values)) return unknown("missing-format-field", name);
        const raw = values[name];
        if (typeof raw === "string" && /[\r\n]/.test(raw)) return unknown("multiline-format-value", name);
        try { assertDomainValue(domain, raw, `FORMATS.${head}.${name}`); } catch (error) { return unknown("domain-invalid", { name, message: error.message }); }
        parts.push(`${name}: ${renderDomainValue(domain, raw)}`);
      }
      return parts.length === 0 ? `${timestamp} ${head}` : `${timestamp} ${head}: ${parts.join("; ")}`;
    },
    parse(text) {
      try {
        if (typeof text !== "string" || /[\r\n]/.test(text)) return invalid("multiline");
        const firstSpace = text.indexOf(" ");
        if (firstSpace < 0) return invalid("missing-head");
        const timestamp = text.slice(0, firstSpace);
        if (!validateTimestamp(timestamp)) return invalid("bad-timestamp");
        const prefix = entries.length === 0 ? head : `${head}: `;
        if (!text.slice(firstSpace + 1).startsWith(prefix)) return invalid("head-mismatch");
        if (entries.length === 0 && text.slice(firstSpace + 1) !== head) return invalid("trailing-data");
        let rest = text.slice(firstSpace + 1 + prefix.length);
        const values = {};
        for (let index = 0; index < entries.length; index += 1) {
          const [name, domain] = entries[index];
          const label = `${name}: `;
          if (!rest.startsWith(label)) return invalid(`missing-field:${name}`);
          rest = rest.slice(label.length);
          const nextName = entries[index + 1]?.[0] ?? null;
          let raw;
          if (isStructuredDomain(domain) && rest !== "NONE" && !rest.startsWith("NONE; ")) {
            const end = scanJsonEnd(rest);
            if (end < 0) return invalid(`bad-json:${name}`);
            raw = rest.slice(0, end);
            if (nextName && !rest.slice(end).startsWith(`; ${nextName}: `)) return invalid(`field-boundary:${name}`);
            rest = nextName ? rest.slice(end + 2) : rest.slice(end);
          } else if (nextName) {
            const separator = `; ${nextName}: `;
            const at = rest.indexOf(separator);
            if (at < 0) return invalid(`missing-field:${nextName}`);
            raw = rest.slice(0, at);
            rest = rest.slice(at + 2);
          } else {
            raw = rest;
            rest = "";
          }
          const value = coerceParsed(domain, raw);
          try { assertDomainValue(domain, value, `FORMATS.${head}.${name}`); } catch { return invalid(`domain:${name}`); }
          values[name] = value;
        }
        if (rest.length > 0) return invalid("trailing-data");
        return { ok: true, timestamp, fields: values };
      } catch (error) {
        return invalid(error.message);
      }
    }
  };
  return Object.freeze(format);
}

function scanJsonEnd(text) {
  let inString = false;
  let escaped = false;
  let depth = 0;
  let started = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') { inString = true; started = true; continue; }
    if (char === "{" || char === "[") { depth += 1; started = true; continue; }
    if (char === "}" || char === "]") { depth -= 1; if (depth < 0) return -1; }
    if (!/\s/.test(char)) started = true;
    const nextBoundary = text.slice(index + 1).startsWith("; ");
    if (started && depth === 0 && !inString && (index === text.length - 1 || nextBoundary)) {
      const candidate = text.slice(0, index + 1).trimEnd();
      try { JSON.parse(candidate); return candidate.length; } catch { /* continue */ }
    }
  }
  try { JSON.parse(text); return text.length; } catch { return -1; }
}

function coerceParsed(domain, raw) {
  if (domain === "integer") return /^\d+$/.test(raw) ? Number(raw) : raw;
  if (raw === "NONE" && typeof domain === "string" && domain.endsWith("|NONE")) return raw;
  if (isStructuredDomain(domain)) return JSON.parse(raw);
  return raw;
}

function renderDomainValue(domain, value) {
  if (value === "NONE" && typeof domain === "string" && domain.endsWith("|NONE")) return value;
  return isStructuredDomain(domain) ? JSON.stringify(value) : String(value);
}

function isStructuredDomain(domain) {
  if (domain && typeof domain === "object" && !Array.isArray(domain)) return true;
  if (typeof domain !== "string") return false;
  const base = domain.endsWith("|NONE") ? domain.slice(0, -5) : domain;
  return base === "json" || base.startsWith("list:[");
}

function invalid(reason) {
  return { ok: false, reason };
}

export function compareCardNumbers(a, b) {
  const left = String(a).split(".").map(Number);
  const right = String(b).split(".").map(Number);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const delta = (left[index] ?? -1) - (right[index] ?? -1);
    if (delta !== 0) return delta;
  }
  return 0;
}

export function comparePaths(a, b) {
  return String(a).localeCompare(String(b), "en", { numeric: true });
}

export function template(ref) {
  return Object.freeze({ template: ref });
}
