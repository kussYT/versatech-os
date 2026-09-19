export const ALREADY_CONSUMED = "ALREADY_CONSUMED" as const;

export type AlreadyConsumedCode = typeof ALREADY_CONSUMED;

export class AlreadyConsumedError extends Error {
  readonly code: AlreadyConsumedCode = ALREADY_CONSUMED;
  readonly actionId: string;

  constructor(actionId: string) {
    super(ALREADY_CONSUMED);
    this.name = "AlreadyConsumedError";
    this.actionId = actionId;
  }
}

export function isAlreadyConsumedError(error: unknown): error is AlreadyConsumedError {
  return error instanceof AlreadyConsumedError;
}
