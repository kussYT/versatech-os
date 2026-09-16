import {
  addCivilDays,
  civilKey,
  fromParisDateTime,
  parisDateKey,
  parisParts,
  type CivilDate,
} from "@/lib/dates";
import { isActiveMaintenanceStatus } from "@/lib/maintenance/status";
import type { MaintenanceStatus } from "@/generated/prisma/client";

export const UPCOMING_DUE_DAYS = 30;

export function addCivilMonths(date: CivilDate, months: number): CivilDate {
  const total = date.year * 12 + (date.month - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    year,
    month,
    day: Math.min(date.day, lastDay),
  };
}

function toCivil(value: Date): CivilDate {
  const parts = parisParts(value);
  return { year: parts.year, month: parts.month, day: parts.day };
}

/**
 * Prochaine échéance mensuelle : anniversaire civil de startDate (Europe/Paris).
 * Non persistée — le modèle n'a pas de nextDueDate.
 * Uniquement pour les contrats ACTIVE ; respect de endDate s'il existe.
 */
export function nextMaintenanceDueDate(input: {
  startDate: Date;
  endDate?: Date | null;
  status: MaintenanceStatus;
  now?: Date;
}): Date | null {
  if (!isActiveMaintenanceStatus(input.status)) {
    return null;
  }

  const now = input.now ?? new Date();
  const todayKey = parisDateKey(now);
  const anchor = toCivil(input.startDate);
  let offset = 0;
  let candidate = anchor;

  while (civilKey(candidate) < todayKey && offset < 600) {
    offset += 1;
    candidate = addCivilMonths(anchor, offset);
  }

  if (input.endDate && civilKey(candidate) > parisDateKey(input.endDate)) {
    return null;
  }

  return fromParisDateTime(candidate.year, candidate.month, candidate.day);
}

export function isUpcomingMaintenanceDue(dueAt: Date, now = new Date(), days = UPCOMING_DUE_DAYS) {
  const today = toCivil(now);
  const horizon = addCivilDays(today.year, today.month, today.day, days);
  const dueKey = parisDateKey(dueAt);
  return dueKey >= civilKey(today) && dueKey <= civilKey(horizon);
}
