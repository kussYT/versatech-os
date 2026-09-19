import "server-only";

export const PERMISSION_LEVELS = ["READ", "WRITE", "CRITICAL"] as const;

export type PermissionLevel = (typeof PERMISSION_LEVELS)[number];

/** ADR-014 coded WRITE ceiling (enforced when WRITE becomes executable). */
export const WRITE_MAX_PER_TURN = 3;

/** CRITICAL is never autonomous and never chained. */
export const CRITICAL_MAX_PER_TURN = 0;

/**
 * This wave: only READ may run. WRITE and CRITICAL stay typed / catalogued
 * but executeTool must refuse them even if an executor is registered later.
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
