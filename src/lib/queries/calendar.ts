import "server-only";

import { requireAuthenticatedUser } from "@/lib/auth/dal";

import type { CalendarEventType } from "@/generated/prisma/client";
import { startOfLocalDay, endOfLocalDay, isLocalMidnight } from "@/lib/calendar/dates";
import type {
  CalendarCompanyOption,
  CalendarItem,
  CalendarItemKind,
  CalendarProjectOption,
} from "@/lib/calendar/types";
import { OPEN_TASK_STATUSES } from "@/lib/crm/constants";
import { tourStopsToCalendarItems } from "@/lib/calendar/terrain-visits";
import { endOfToday, startOfToday } from "@/lib/crm/form-data";
import { prisma } from "@/lib/db/prisma";

type LinkRef = { id: string; name: string } | null;

function toIso(date: Date) {
  return date.toISOString();
}

function isOverdue(date: Date, todayStart: Date) {
  return date.getTime() < todayStart.getTime();
}

function item(input: {
  kind: CalendarItemKind;
  entityId: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  eventType: CalendarEventType | null;
  href: string | null;
  company: LinkRef;
  project: LinkRef;
  editable: boolean;
  overdue: boolean;
  visitOrder?: number | null;
  visitStatus?: "pending" | "visited" | null;
  secondaryHref?: string | null;
}): CalendarItem {
  return {
    id: `${input.kind}:${input.entityId}`,
    kind: input.kind,
    entityId: input.entityId,
    title: input.title,
    startsAt: toIso(input.startsAt),
    endsAt: toIso(input.endsAt),
    allDay: input.allDay,
    eventType: input.eventType,
    href: input.href,
    company: input.company,
    project: input.project,
    editable: input.editable,
    overdue: input.overdue,
    visitOrder: input.visitOrder ?? null,
    visitStatus: input.visitStatus ?? null,
    secondaryHref: input.secondaryHref ?? null,
  };
}

export function mergeCalendarItems(groups: CalendarItem[][]) {
  const map = new Map<string, CalendarItem>();
  for (const group of groups) {
    for (const entry of group) {
      map.set(entry.id, entry);
    }
  }

  return [...map.values()].sort((left, right) => {
    const byStart = left.startsAt.localeCompare(right.startsAt);
    if (byStart !== 0) {
      return byStart;
    }
    if (left.kind === "terrain_visit" && right.kind === "terrain_visit") {
      return (left.visitOrder ?? 0) - (right.visitOrder ?? 0);
    }
    return left.title.localeCompare(right.title, "fr");
  });
}

/** Caller must authenticate. Used by Calendar UI and TodayService. */
export async function loadCalendarItems(
  rangeStart: Date,
  rangeEnd: Date,
  now = new Date(),
): Promise<CalendarItem[]> {
  const todayStart = startOfToday(now);
  const range = { gte: rangeStart, lte: rangeEnd };

  const [events, followUps, tasks, projects, milestones, tours] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: {
        startsAt: { lte: rangeEnd },
        endsAt: { gte: rangeStart },
      },
      select: {
        id: true,
        title: true,
        type: true,
        startsAt: true,
        endsAt: true,
        allDay: true,
        companyId: true,
        projectId: true,
        company: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    }),
    prisma.followUp.findMany({
      where: { status: "PENDING", dueAt: range },
      select: {
        id: true,
        title: true,
        dueAt: true,
        company: { select: { id: true, name: true } },
      },
    }),
    prisma.task.findMany({
      where: { status: { in: [...OPEN_TASK_STATUSES] }, dueAt: range },
      select: {
        id: true,
        title: true,
        dueAt: true,
        companyId: true,
        projectId: true,
        company: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    }),
    prisma.project.findMany({
      where: {
        status: { notIn: ["COMPLETED", "ARCHIVED"] },
        dueDate: range,
      },
      select: {
        id: true,
        name: true,
        dueDate: true,
        company: { select: { id: true, name: true } },
      },
    }),
    prisma.milestone.findMany({
      where: { status: "PENDING", dueAt: range },
      select: {
        id: true,
        name: true,
        dueAt: true,
        projectId: true,
        project: {
          select: {
            id: true,
            name: true,
            company: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.tour.findMany({
      where: { date: { gte: rangeStart, lte: rangeEnd } },
      select: {
        date: true,
        stops: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            order: true,
            visitedAt: true,
            company: { select: { id: true, name: true } },
          },
        },
      },
    }),
  ]);

  return mergeCalendarItems([
    events.map((event) =>
      item({
        kind: "event",
        entityId: event.id,
        title: event.title,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        allDay: event.allDay,
        eventType: event.type,
        href: event.company
          ? `/entreprises/${event.company.id}`
          : event.project
            ? `/projets/${event.project.id}`
            : null,
        company: event.company,
        project: event.project,
        editable: true,
        overdue: false,
      }),
    ),
    followUps.map((followUp) =>
      item({
        kind: "follow_up",
        entityId: followUp.id,
        title: followUp.title,
        startsAt: followUp.dueAt,
        endsAt: followUp.dueAt,
        allDay: false,
        eventType: null,
        href: `/entreprises/${followUp.company.id}`,
        company: followUp.company,
        project: null,
        editable: false,
        overdue: isOverdue(followUp.dueAt, todayStart),
      }),
    ),
    tasks.map((task) => {
      const dueAt = task.dueAt ?? rangeStart;
      return item({
        kind: "task",
        entityId: task.id,
        title: task.title,
        startsAt: dueAt,
        endsAt: dueAt,
        allDay: isLocalMidnight(dueAt),
        eventType: null,
        href: task.project
          ? `/projets/${task.project.id}`
          : task.company
            ? `/entreprises/${task.company.id}`
            : "/projets",
        company: task.company,
        project: task.project,
        editable: false,
        overdue: isOverdue(dueAt, todayStart),
      });
    }),
    projects.map((project) => {
      const dueDate = project.dueDate ?? rangeStart;
      return item({
        kind: "project",
        entityId: project.id,
        title: project.name,
        startsAt: startOfLocalDay(dueDate),
        endsAt: endOfLocalDay(dueDate),
        allDay: true,
        eventType: null,
        href: `/projets/${project.id}`,
        company: project.company,
        project: { id: project.id, name: project.name },
        editable: false,
        overdue: isOverdue(dueDate, todayStart),
      });
    }),
    milestones.map((milestone) => {
      const dueAt = milestone.dueAt ?? rangeStart;
      const allDay = isLocalMidnight(dueAt);
      return item({
        kind: "milestone",
        entityId: milestone.id,
        title: milestone.name,
        startsAt: allDay ? startOfLocalDay(dueAt) : dueAt,
        endsAt: allDay ? endOfLocalDay(dueAt) : dueAt,
        allDay,
        eventType: null,
        href: `/projets/${milestone.project.id}`,
        company: milestone.project.company,
        project: { id: milestone.project.id, name: milestone.project.name },
        editable: false,
        overdue: isOverdue(dueAt, todayStart),
      });
    }),
    tourStopsToCalendarItems(
      tours.flatMap((tour) =>
        tour.stops.map((stop) => ({
          stopId: stop.id,
          order: stop.order,
          visitedAt: stop.visitedAt,
          tourDate: tour.date,
          company: stop.company,
        })),
      ),
    ),
  ]);
}

export async function listCalendarItems(rangeStart: Date, rangeEnd: Date): Promise<CalendarItem[]> {
  await requireAuthenticatedUser();
  return loadCalendarItems(rangeStart, rangeEnd);
}

/** Caller must authenticate. Agenda of the Europe/Paris civil day for `now`. */
export async function loadTodayAgenda(now = new Date()): Promise<CalendarItem[]> {
  return loadCalendarItems(startOfToday(now), endOfToday(now), now);
}

export async function getTodayAgenda(): Promise<CalendarItem[]> {
  await requireAuthenticatedUser();
  return loadTodayAgenda();
}

export async function listCalendarLinkTargets(): Promise<{
  companies: CalendarCompanyOption[];
  projects: CalendarProjectOption[];
}> {
  await requireAuthenticatedUser();
  const [companies, projects] = await Promise.all([
    prisma.company.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.project.findMany({
      where: { status: { notIn: ["ARCHIVED"] } },
      select: { id: true, name: true, companyId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return { companies, projects };
}
