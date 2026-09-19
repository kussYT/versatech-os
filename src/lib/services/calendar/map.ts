import "server-only";

import type { CalendarItem } from "@/lib/calendar/types";
import {
  clampCollection,
  parseCalendarList,
  type CalendarItemAgentDto,
  type CalendarListDto,
} from "./schema";

export function mapCalendarItemAgent(item: CalendarItem): CalendarItemAgentDto {
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

export function mapCalendarList(
  items: readonly CalendarItem[],
  from: string,
  to: string,
  limit: number,
): CalendarListDto {
  const truncated = items.length > limit;
  const mapped = clampCollection(items.map(mapCalendarItemAgent), limit);
  return parseCalendarList({
    from,
    to,
    items: mapped,
    returned: mapped.length,
    truncated,
  });
}
