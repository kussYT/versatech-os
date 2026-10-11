import type { ProjectStatus } from "@/generated/prisma/client";
import { parisDateKey, startOfParisDay } from "@/lib/dates";

/**
 * Démarrer (Planifié → Actif) enregistre le jour civil courant si aucune date
 * de début n'existe, ou si la date prévue est encore dans le futur.
 * Une date déjà passée ou égale à aujourd'hui est conservée.
 * Les autres transitions ne fabriquent pas de date.
 */
export function startDateAfterDemarrer(input: {
  fromStatus: ProjectStatus;
  toStatus: ProjectStatus;
  startDate: Date | null;
  now: Date;
}): Date | null {
  if (input.fromStatus !== "PLANNED" || input.toStatus !== "ACTIVE") {
    return input.startDate;
  }

  const today = startOfParisDay(input.now);
  if (!input.startDate || parisDateKey(input.startDate) > parisDateKey(input.now)) {
    return today;
  }

  return input.startDate;
}

/** Une date explicite sur un projet déjà sorti de Planifié ne peut pas être future. */
export function validateExplicitStartDate(input: {
  status: ProjectStatus;
  startDate: Date;
  now: Date;
}): { ok: true } | { ok: false; message: string } {
  if (input.status !== "PLANNED" && parisDateKey(input.startDate) > parisDateKey(input.now)) {
    return {
      ok: false,
      message: "La date de début d'un projet déjà démarré ne peut pas être dans le futur.",
    };
  }

  return { ok: true };
}
