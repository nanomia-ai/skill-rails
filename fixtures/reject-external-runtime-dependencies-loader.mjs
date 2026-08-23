export async function resolve(specifier, context, nextResolve) {
  const packageLocal = specifier.startsWith(".") || specifier.startsWith("/") || specifier.startsWith("file:") || specifier.startsWith("node:");
  if (!packageLocal) throw new Error(`External runtime dependency loaded on a portable creator path: ${specifier}`);
  return nextResolve(specifier, context);
}
