import "server-only";

import type { CalendarItem } from "@/lib/calendar/types";
import { ACTIVITY_LABELS } from "@/lib/crm/activity-labels";
import { parisDateKey } from "@/lib/dates";
import type { FinanceTotals } from "@/lib/finance";
import type { RecentActivityItem as RecentActivityQueryItem } from "@/lib/queries/activity";
import type { CompanyListItem } from "@/lib/queries/companies";
import type { FollowUpDashboard } from "@/lib/queries/follow-ups";
import type { PipelineOverviewLoad } from "@/lib/queries/opportunities";
import type { DashboardTaskItem } from "@/lib/queries/projects";
import {
  clampTodayOverviewCollections,
  parseTodayOverview,
  pipelineCountsSchema,
  TODAY_OVERVIEW_LIMITS,
  TODAY_OVERVIEW_TIMEZONE,
  type AgendaItem,
  type CompanyCallPreview,
  type FollowUpPreview,
  type TaskPreview,
  type TodayOverview,
} from "./schema";

/** Tour projection used by the mapper — structural, no Prisma. */
export type TodayLoadedTour = {
  stops: Array<{
    id: string;
    order: number;
    visitedAt: string | null;
    company: { id: string; name: string };
  }>;
} | null;

export type TodayLoaded = {
  pipeline: PipelineOverviewLoad;
  followUps: FollowUpDashboard;
  finance: FinanceTotals;
  tasks: { openCount: number; preview: DashboardTaskItem[] };
  agenda: CalendarItem[];
  calls: CompanyListItem[];
  interactionCounts: { calls: number; meetings: number };
  recentActivity: RecentActivityQueryItem[];
  tour: TodayLoadedTour;
};

function toAgendaItem(item: CalendarItem): AgendaItem {
  const isTerrain = item.kind === "terrain_visit";
  return {
    id: item.id,
    kind: item.kind,
    entityId: item.entityId,
    title: item.title,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    allDay: item.allDay,
    eventType: item.kind === "event" ? item.eventType : null,
    company: item.company,
    project: item.project,
    overdue: item.overdue,
    visitOrder: isTerrain ? (item.visitOrder ?? null) : null,
    visitStatus: isTerrain ? (item.visitStatus ?? null) : null,
  };
}

function toFollowUpPreview(item: FollowUpDashboard["preview"][number]): FollowUpPreview {
  return {
    id: item.id,
    title: item.title,
    dueAt: item.dueAt,
    status: item.status,
    company: { id: item.company.id, name: item.company.name },
  };
}

function toCallPreview(company: CompanyListItem): CompanyCallPreview {
  return {
    id: company.id,
    name: company.name,
    city: company.city,
    industry: company.industry,
    lifecycleStatus: company.lifecycleStatus,
    source: company.source,
    priority: company.priority,
    primaryContact: company.primaryContact,
    lastInteractionAt: company.lastInteractionAt,
    lastInteractionType: company.lastInteractionType,
    nextFollowUpAt: company.nextFollowUpAt,
    nextFollowUpTitle: company.nextFollowUpTitle,
  };
}

function toTaskPreview(task: DashboardTaskItem): TaskPreview {
  return {
    id: task.id,
    title: task.title,
    dueAt: task.dueAt,
    priority: task.priority,
    project: task.project,
  };
}

/**
 * Same counters as `toTourDashboard` (`queries/tours.ts`): planned = stops.length,
 * nextNames = first 3 unvisited company names. Inlined so this mapper stays DB-free.
 */
function tourSummaryFromLoaded(tour: TodayLoadedTour) {
  if (!tour) {
    return {
      planned: 0,
      visited: 0,
      remaining: 0,
      nextNames: [] as string[],
      nextStops: [] as Array<{ companyId: string; name: string }>,
      stops: [] as Array<{
        id: string;
        order: number;
        visitedAt: string | null;
        company: { id: string; name: string };
      }>,
    };
  }

  const visited = tour.stops.filter((stop) => stop.visitedAt).length;
  const remainingStops = tour.stops.filter((stop) => !stop.visitedAt);
  const nextStops = remainingStops.slice(0, TODAY_OVERVIEW_LIMITS.tourNextStops).map((stop) => ({
    companyId: stop.company.id,
    name: stop.company.name,
  }));

  return {
    planned: tour.stops.length,
    visited,
    remaining: tour.stops.length - visited,
    nextNames: nextStops.map((stop) => stop.name),
    nextStops,
    stops: tour.stops.slice(0, TODAY_OVERVIEW_LIMITS.tourStops).map((stop) => ({
      id: stop.id,
      order: stop.order,
      visitedAt: stop.visitedAt,
      company: { id: stop.company.id, name: stop.company.name },
    })),
  };
}

/**
 * Query DTOs → agent `TodayOverview`. Pipeline brut/weighted come from money.ts
 * strings (`brutTotalMoney` / `weightedTotalMoney`), never the UI `number` totals.
 * Calendar `href` / `secondaryHref` are dropped (UI adapter rebuilds them).
 */
export function mapTodayOverview(loaded: TodayLoaded, now: Date): TodayOverview {
  const overview = {
    generatedAt: now.toISOString(),
    civilDate: parisDateKey(now),
    timezone: TODAY_OVERVIEW_TIMEZONE,
    tour: tourSummaryFromLoaded(loaded.tour),
    calls: loaded.calls.map(toCallPreview),
    followUps: {
      dueCount: loaded.followUps.dueCount,
      overdueCount: loaded.followUps.overdueCount,
      todayCount: loaded.followUps.todayCount,
      preview: loaded.followUps.preview.map(toFollowUpPreview),
    },
    tasks: {
      openCount: loaded.tasks.openCount,
      preview: loaded.tasks.preview.map(toTaskPreview),
    },
    agenda: loaded.agenda.map(toAgendaItem),
    pipeline: {
      openCount: loaded.pipeline.openCount,
      brutTotal: loaded.pipeline.brutTotalMoney,
      weightedTotal: loaded.pipeline.weightedTotalMoney,
      counts: pipelineCountsSchema.parse(loaded.pipeline.counts),
    },
    finance: {
      signed: loaded.finance.signed,
      collected: loaded.finance.collected,
      remaining: loaded.finance.remaining,
      overdueCount: loaded.finance.overdueCount,
    },
    interactionsToday: {
      calls: loaded.interactionCounts.calls,
      meetings: loaded.interactionCounts.meetings,
    },
    recentActivity: loaded.recentActivity.map((item) => ({
      id: item.id,
      action: item.action,
      label: ACTIVITY_LABELS[item.action] ?? item.action,
      entityType: item.entityType,
      createdAt: item.createdAt,
      actorName: item.actorName,
    })),
  };

  return parseTodayOverview(clampTodayOverviewCollections(overview));
}
