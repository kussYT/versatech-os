import {
  CALENDAR_EVENT_TYPE_LABELS,
} from "@/lib/crm/constants";
import type { CalendarItem, CalendarItemKind } from "@/lib/calendar/types";

export const CALENDAR_KIND_LABELS: Record<CalendarItemKind, string> = {
  event: "Événement",
  follow_up: "Relance",
  task: "Tâche",
  project: "Deadline",
  milestone: "Jalon",
};

export function calendarItemLabel(item: CalendarItem) {
  if (item.kind === "event" && item.eventType) {
    return CALENDAR_EVENT_TYPE_LABELS[item.eventType];
  }

  return CALENDAR_KIND_LABELS[item.kind];
}
