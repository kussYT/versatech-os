import { endOfParisDay, parisDateKey, startOfParisDay } from "@/lib/dates";
import type { CalendarItem } from "@/lib/calendar/types";

export type TourStopCalendarSource = {
  stopId: string;
  order: number;
  visitedAt: Date | string | null;
  tourDate: Date | string;
  company: { id: string; name: string };
};

export function terrainVisitTitle(companyName: string) {
  return `Visite terrain — ${companyName}`;
}

export function tourStopToCalendarItem(stop: TourStopCalendarSource): CalendarItem {
  const startsAt = startOfParisDay(stop.tourDate);
  const endsAt = endOfParisDay(stop.tourDate);
  const visited = Boolean(stop.visitedAt);

  return {
    id: `terrain_visit:${stop.stopId}`,
    kind: "terrain_visit",
    entityId: stop.stopId,
    title: terrainVisitTitle(stop.company.name),
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    allDay: true,
    eventType: null,
    href: `/entreprises/${stop.company.id}`,
    company: stop.company,
    project: null,
    editable: false,
    overdue: false,
    visitOrder: stop.order,
    visitStatus: visited ? "visited" : "pending",
    secondaryHref: "/tournee",
  };
}

export function tourStopsToCalendarItems(stops: TourStopCalendarSource[]) {
  return stops
    .map(tourStopToCalendarItem)
    .sort((left, right) => {
      const byStart = left.startsAt.localeCompare(right.startsAt);
      if (byStart !== 0) {
        return byStart;
      }
      return (left.visitOrder ?? 0) - (right.visitOrder ?? 0);
    });
}

export function terrainVisitCivilKey(tourDate: Date | string) {
  return parisDateKey(startOfParisDay(tourDate));
}
