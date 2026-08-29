export function parseArgs(argv, options = {}) {
  const booleans = new Set(options.booleans ?? []);
  const repeated = new Set(options.repeated ?? []);
  const values = new Set(options.values ?? []);
  const allowed = new Set([...booleans, ...repeated, ...values]);
  const parsed = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      if (!options.allowPositionals) throw new Error(`Unexpected positional argument: ${token}`);
      parsed._.push(token);
      continue;
    }
    const equal = token.indexOf("=");
    const key = token.slice(2, equal > 0 ? equal : undefined);
    if (!key || !allowed.has(key)) throw new Error(`Unknown option: --${key || "<empty>"}`);
    if (booleans.has(key)) {
      if (Object.hasOwn(parsed, key)) throw new Error(`Duplicate option: --${key}`);
      if (equal > 0) {
        const raw = token.slice(equal + 1);
        if (raw !== "true" && raw !== "false") throw new Error(`Boolean option --${key} accepts only true or false`);
        parsed[key] = raw === "true";
      } else {
        if (["true", "false"].includes(argv[index + 1])) throw new Error(`Boolean option --${key} uses --${key}=true or --${key}=false; a separate value is forbidden.`);
        parsed[key] = true;
      }
      continue;
    }
    const value = equal > 0 ? token.slice(equal + 1) : argv[++index];
    if (value === undefined || value.startsWith("--")) throw new Error(`Missing value for --${key}`);
    if (repeated.has(key)) (parsed[key] ??= []).push(value);
    else {
      if (Object.hasOwn(parsed, key)) throw new Error(`Duplicate option: --${key}`);
      parsed[key] = value;
    }
  }
  return parsed;
}

export function requireArg(parsed, key) {
  if (!parsed[key]) throw new Error(`Required argument is missing: --${key}`);
  return parsed[key];
}
