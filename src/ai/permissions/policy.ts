import "server-only";

export const PERMISSION_LEVELS = ["READ", "WRITE", "CRITICAL"] as const;

export type PermissionLevel = (typeof PERMISSION_LEVELS)[number];

/** ADR-014 coded WRITE ceiling. Orchestrator this wave is stricter: 1 proposal. */
export const WRITE_MAX_PER_TURN = 3;

/**
 * Confirmable WRITE proposals per chat request. One mutation card at a time,
 * even though ADR-014 allows up to {@link WRITE_MAX_PER_TURN}.
 */
export const WRITE_CONFIRMABLE_MAX_PER_TURN = 1;

/** CRITICAL is never autonomous and never chained. */
export const CRITICAL_MAX_PER_TURN = 0;

/**
 * Direct execution: READ only.
 * Confirmable WRITE is proposable via executeTool (CONFIRMATION_REQUIRED)
 * but is not executable — mutation is `executeConfirmedWrite` after B's checks.
 * CRITICAL is never executable and never proposable.
 */
export function isPermissionExecutable(level: PermissionLevel): boolean {
  return level === "READ";
}

export function refusalCodeForPermission(
  level: Exclude<PermissionLevel, "READ">,
): "FORBIDDEN" | "NOT_AVAILABLE" {
  return level === "CRITICAL" ? "FORBIDDEN" : "NOT_AVAILABLE";
}

export function refusalMessageForPermission(level: Exclude<PermissionLevel, "READ">): string {
  return level === "CRITICAL"
    ? "Les actions critiques ne sont pas disponibles."
    : "Les actions d'écriture ne sont pas disponibles.";
}
