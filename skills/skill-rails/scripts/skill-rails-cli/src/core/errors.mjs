export class SkillRailsError extends Error {
  constructor(code, message, nextAction, details = undefined) {
    super(message);
    this.name = "SkillRailsError";
    this.code = code;
    this.nextAction = nextAction;
    this.details = details;
  }
}
export function fail(code, message, nextAction, details) {
  throw new SkillRailsError(code, message, nextAction, details);
}

export function toResultError(error) {
  if (error instanceof SkillRailsError) {
    return {
      schemaVersion: 1,
      status: "ERROR",
      code: error.code,
      message: error.message,
      nextAction: error.nextAction,
      ...(error.details === undefined ? {} : { details: error.details }),
    };
  }
  return {
    schemaVersion: 1,
    status: "ERROR",
    code: "INTERNAL_ERROR",
    message: error instanceof Error ? error.message : String(error),
    nextAction: "Inspect the current source and retry after correcting the owning implementation.",
  };
}
