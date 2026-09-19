import "server-only";

import type { SessionUser } from "@/lib/auth/types";
import { loadTodayInteractionCounts, loadRecentActivity } from "@/lib/queries/activity";
import { loadTodayAgenda } from "@/lib/queries/calendar";
import { loadCompaniesToCall } from "@/lib/queries/companies";
import { loadFollowUpDashboard } from "@/lib/queries/follow-ups";
import { loadPipelineOverview } from "@/lib/queries/opportunities";
import { loadFinanceSnapshot } from "@/lib/queries/payments";
import { loadTaskDashboard } from "@/lib/queries/projects";
import { loadTodayTour } from "@/lib/queries/tours";
import { toTodayDashboardView } from "./map-dashboard";
import { mapTodayOverview } from "./map-overview";
import { parseTodayOverview, TODAY_OVERVIEW_LIMITS, type TodayOverview } from "./schema";

export type { TodayLoaded, TodayLoadedTour } from "./map-overview";
export { mapTodayOverview } from "./map-overview";

export type GetTodayOverviewInput = {
  actor: SessionUser;
  now?: Date;
};

export type { TodayDashboardView } from "./map-dashboard";
export { toTodayDashboardView } from "./map-dashboard";

/**
 * Briefing du jour civil Europe/Paris. READ only — no ActivityLog, no redirect.
 * `actor` is required (auth happens upstream); V1 queries are not user-scoped.
 */
export async function getTodayOverview({
  actor,
  now = new Date(),
}: GetTodayOverviewInput): Promise<TodayOverview> {
  if (!actor.id) {
    throw new Error("Acteur requis.");
  }

  const [
    pipeline,
    followUps,
    finance,
    tasks,
    agenda,
    calls,
    interactionCounts,
    recentActivity,
    tour,
  ] = await Promise.all([
    loadPipelineOverview(),
    loadFollowUpDashboard(TODAY_OVERVIEW_LIMITS.followUps, now),
    loadFinanceSnapshot({}, now),
    loadTaskDashboard(TODAY_OVERVIEW_LIMITS.tasks),
    loadTodayAgenda(now),
    loadCompaniesToCall(TODAY_OVERVIEW_LIMITS.calls),
    loadTodayInteractionCounts(now),
    loadRecentActivity(TODAY_OVERVIEW_LIMITS.recentActivity),
    loadTodayTour(now),
  ]);

  return parseTodayOverview(
    mapTodayOverview(
      {
        pipeline,
        followUps,
        finance,
        tasks,
        agenda,
        calls,
        interactionCounts,
        recentActivity,
        tour,
      },
      now,
    ),
  );
}

export const TodayService = {
  getTodayOverview,
  toTodayDashboardView,
};
