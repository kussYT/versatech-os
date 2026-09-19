import "server-only";

import type { CalendarItem, CalendarItemKind } from "@/lib/calendar/types";
import { tryParseMoneyToCents } from "@/lib/money";
import type { RecentActivityItem as RecentActivityQueryItem } from "@/lib/queries/activity";
import type { CompanyListItem } from "@/lib/queries/companies";
import type { FollowUpListItem } from "@/lib/queries/follow-ups";
import type { PipelineOverview } from "@/lib/queries/opportunities";
import type { DashboardTaskItem } from "@/lib/queries/projects";
import type { TourDashboard } from "@/lib/queries/tours";
import type { AgendaItem, CompanyCallPreview, TodayOverview } from "./schema";

export type TodayDashboardView = {
  pipelineOverview: PipelineOverview;
  followUps: { dueCount: number; preview: FollowUpListItem[] };
  finance: {
    signed: string;
    collected: string;
    remaining: string;
    overdueCount: number;
  };
  taskDashboard: { openCount: number; preview: DashboardTaskItem[] };
  agenda: CalendarItem[];
  calls: CompanyListItem[];
  interactionCounts: { calls: number; meetings: number };
  recentActivity: RecentActivityQueryItem[];
  tourDashboard: TourDashboard;
};

/** UI `PipelineOverview` still uses `number`; source of truth is money.ts cents. */
function moneyStringToDashboardNumber(value: string): number {
  const cents = tryParseMoneyToCents(value);
  if (cents === null) {
    return 0;
  }
  return Number(cents) / 100;
}

/**
 * Rebuilds the same hrefs as `queries/calendar.ts` + `tourStopsToCalendarItems`
 * so a future page adapter can stay visually identical without storing href on the agent DTO.
 */
export function calendarItemUiHrefs(item: {
  kind: CalendarItemKind;
  entityId: string;
  company: { id: string } | null;
  project: { id: string } | null;
}): { href: string | null; secondaryHref: string | null } {
  switch (item.kind) {
    case "event":
      return {
        href: item.company
          ? `/entreprises/${item.company.id}`
          : item.project
            ? `/projets/${item.project.id}`
            : null,
        secondaryHref: null,
      };
    case "follow_up":
      return {
        href: item.company ? `/entreprises/${item.company.id}` : null,
        secondaryHref: null,
      };
    case "task":
      return {
        href: item.project
          ? `/projets/${item.project.id}`
          : item.company
            ? `/entreprises/${item.company.id}`
            : "/projets",
        secondaryHref: null,
      };
    case "project":
      return {
        href: `/projets/${item.entityId}`,
        secondaryHref: null,
      };
    case "milestone":
      return {
        href: item.project ? `/projets/${item.project.id}` : "/projets",
        secondaryHref: null,
      };
    case "terrain_visit":
      return {
        href: item.company ? `/entreprises/${item.company.id}` : "/tournee",
        secondaryHref: "/tournee",
      };
  }
}

function toCalendarItem(item: AgendaItem): CalendarItem {
  const { href, secondaryHref } = calendarItemUiHrefs(item);
  return {
    id: item.id,
    kind: item.kind,
    entityId: item.entityId,
    title: item.title,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    allDay: item.allDay,
    eventType: item.eventType,
    href,
    company: item.company,
    project: item.project,
    editable: item.kind === "event",
    overdue: item.overdue,
    visitOrder: item.visitOrder,
    visitStatus: item.visitStatus,
    secondaryHref,
  };
}

function toCompanyListItem(call: CompanyCallPreview): CompanyListItem {
  return {
    id: call.id,
    name: call.name,
    lifecycleStatus: call.lifecycleStatus,
    industry: call.industry,
    city: call.city,
    priority: call.priority,
    source: call.source,
    primaryContact: call.primaryContact,
    lastInteractionAt: call.lastInteractionAt,
    lastInteractionType: call.lastInteractionType,
    nextFollowUpAt: call.nextFollowUpAt,
    nextFollowUpTitle: call.nextFollowUpTitle,
  };
}

function toFollowUpListItem(item: TodayOverview["followUps"]["preview"][number]): FollowUpListItem {
  return {
    id: item.id,
    title: item.title,
    dueAt: item.dueAt,
    status: item.status,
    completedAt: null,
    company: {
      id: item.company.id,
      name: item.company.name,
      phone: null,
      email: null,
    },
    phone: null,
    email: null,
    lastInteraction: null,
  };
}

/**
 * Page adapter: same props `src/app/page.tsx` passes today.
 * Calendar hrefs are rebuilt from kind + company/project/entity ids (no href on the agent DTO).
 */
export function toTodayDashboardView(overview: TodayOverview): TodayDashboardView {
  return {
    pipelineOverview: {
      counts: overview.pipeline.counts,
      openCount: overview.pipeline.openCount,
      brutTotal: moneyStringToDashboardNumber(overview.pipeline.brutTotal),
      weightedTotal: moneyStringToDashboardNumber(overview.pipeline.weightedTotal),
    },
    followUps: {
      dueCount: overview.followUps.dueCount,
      preview: overview.followUps.preview.map(toFollowUpListItem),
    },
    finance: {
      signed: overview.finance.signed,
      collected: overview.finance.collected,
      remaining: overview.finance.remaining,
      overdueCount: overview.finance.overdueCount,
    },
    taskDashboard: {
      openCount: overview.tasks.openCount,
      preview: overview.tasks.preview,
    },
    agenda: overview.agenda.map(toCalendarItem),
    calls: overview.calls.map(toCompanyListItem),
    interactionCounts: overview.interactionsToday,
    recentActivity: overview.recentActivity.map((item) => ({
      id: item.id,
      action: item.action,
      entityType: item.entityType,
      createdAt: item.createdAt,
      actorName: item.actorName,
    })),
    tourDashboard: {
      planned: overview.tour.planned,
      visited: overview.tour.visited,
      remaining: overview.tour.remaining,
      nextNames: overview.tour.nextNames,
    },
  };
}
