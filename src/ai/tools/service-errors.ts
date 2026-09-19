import "server-only";

/** Same operator message as `FollowUpService.listFollowUps` / tools V1 `getCompany`. */
export const COMPANY_NOT_FOUND_MESSAGE = "Entreprise introuvable.";

export const PROJECT_NOT_FOUND_MESSAGE = "Projet introuvable.";

export const RANGE_TOO_LARGE_MESSAGE = "La plage demandée est trop large.";

export function isCompanyNotFoundError(error: unknown): boolean {
  return error instanceof Error && error.message === COMPANY_NOT_FOUND_MESSAGE;
}

export function isProjectNotFoundError(error: unknown): boolean {
  return error instanceof Error && error.message === PROJECT_NOT_FOUND_MESSAGE;
}

export function isRangeTooLargeError(error: unknown): boolean {
  return error instanceof Error && error.message === RANGE_TOO_LARGE_MESSAGE;
}
