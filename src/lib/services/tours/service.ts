import "server-only";

import type { SessionUser } from "@/lib/auth/types";
import { loadTodayTour } from "@/lib/queries/tours";
import { mapTodayTour } from "./map";
import { requireServiceActor, type TodayTourDto } from "./schema";

export type GetTodayTourInput = {
  actor: SessionUser;
  now?: Date;
};

/**
 * Tournée du jour civil Europe/Paris (`tourDateFor` / `startOfToday`).
 * Ne crée pas de tournée (`ensureTodayTour` interdit en READ).
 * Absent → `null`. READ only — no redirect, no ActivityLog.
 */
export async function getTodayTour({
  actor,
  now = new Date(),
}: GetTodayTourInput): Promise<TodayTourDto | null> {
  requireServiceActor(actor);
  return mapTodayTour(await loadTodayTour(now));
}

export const TourService = {
  getTodayTour,
};
