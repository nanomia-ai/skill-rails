const blocked = new Set(["acorn", "acorn-walk", "ajv", "ajv/dist/2020.js"]);

export async function resolve(specifier, context, nextResolve) {
  if (blocked.has(specifier)) throw new Error(`P2 dependency loaded on a thin path: ${specifier}`);
  return nextResolve(specifier, context);
}
