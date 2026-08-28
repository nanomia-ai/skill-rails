import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export function stableStringify(value) {
  const seen = new WeakSet();
  const normalize = (item) => {
    if (item === undefined) return { $undefined: true };
    if (typeof item === "bigint") return { $bigint: item.toString() };
    if (typeof item === "symbol") return { $symbol: item.description ?? "" };
    if (typeof item === "function") return { $function: item.toString() };
    if (item === null || typeof item !== "object") return item;
    if (seen.has(item)) throw new TypeError("Cannot hash a cyclic object");
    seen.add(item);
    const result = Array.isArray(item)
      ? item.map(normalize)
      : Object.fromEntries(Object.keys(item).sort().map((key) => [key, normalize(item[key])]));
    seen.delete(item);
    return result;
  };
  return JSON.stringify(normalize(value));
}

export function sha256(value) {
  const input = typeof value === "string" || value instanceof Uint8Array
    ? value
    : stableStringify(value);
  return `sha256:${createHash("sha256").update(input).digest("hex")}`;
}

export async function hashFile(path) {
  return sha256(await readFile(path));
}
