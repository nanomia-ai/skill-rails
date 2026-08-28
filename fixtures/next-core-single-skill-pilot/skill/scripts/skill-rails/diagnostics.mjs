export class SkillRailsError extends Error {
  constructor(code, message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "SkillRailsError";
    this.code = code;
    this.pointer = options.pointer ?? null;
    this.hint = options.hint ?? null;
    this.exitCode = options.exitCode ?? 1;
    this.details = options.details ?? null;
  }
}

export function diagnostic(code, pointer, message, hint = null, level = "error") {
  return { code, pointer: pointer ?? null, message, hint, level };
}

export function fail(code, message, options = {}) {
  throw new SkillRailsError(code, message, options);
}

export function normalizeError(error) {
  if (error instanceof SkillRailsError) {
    return {
      code: error.code,
      pointer: error.pointer,
      message: error.message,
      hint: error.hint,
      details: error.details
    };
  }
  return {
    code: "SR_INTERNAL",
    pointer: null,
    message: error instanceof Error ? error.message : String(error),
    hint: "Inspect the stack trace with --debug.",
    details: null
  };
}
