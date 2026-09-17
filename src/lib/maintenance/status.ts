import type { MaintenanceStatus } from "@/generated/prisma/client";

export const MAINTENANCE_STATUSES = [
  "ACTIVE",
  "PAUSED",
  "ENDED",
  "CANCELED",
] as const satisfies readonly MaintenanceStatus[];

export const ACTIVE_MAINTENANCE_STATUSES = ["ACTIVE"] as const satisfies readonly MaintenanceStatus[];

export const INACTIVE_MAINTENANCE_STATUSES = [
  "PAUSED",
  "ENDED",
  "CANCELED",
] as const satisfies readonly MaintenanceStatus[];

export const MAINTENANCE_STATUS_TRANSITIONS: Record<MaintenanceStatus, MaintenanceStatus[]> = {
  ACTIVE: ["PAUSED", "ENDED"],
  PAUSED: ["ACTIVE", "ENDED"],
  ENDED: [],
  CANCELED: [],
};

export function isActiveMaintenanceStatus(status: MaintenanceStatus) {
  return status === "ACTIVE";
}

export function isInactiveMaintenanceStatus(status: MaintenanceStatus) {
  return (INACTIVE_MAINTENANCE_STATUSES as readonly MaintenanceStatus[]).includes(status);
}

export function canTransitionMaintenanceStatus(from: MaintenanceStatus, to: MaintenanceStatus) {
  if (from === to) {
    return true;
  }

  return MAINTENANCE_STATUS_TRANSITIONS[from].includes(to);
}

export function isTerminalMaintenanceStatus(status: MaintenanceStatus) {
  return status === "ENDED" || status === "CANCELED";
}

export function maintenanceTerminationDate(existingEnd: Date | null, today: Date) {
  if (!existingEnd || existingEnd.getTime() > today.getTime()) {
    return today;
  }

  return existingEnd;
}
