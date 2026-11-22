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
  terrain_visit: "Terrain",
};

export function calendarItemLabel(item: CalendarItem) {
  if (item.externalProvider === "google" && item.syncStatus === "imported") {
    return "Google";
  }

  if (item.kind === "event" && item.eventType) {
    return CALENDAR_EVENT_TYPE_LABELS[item.eventType];
  }

  return CALENDAR_KIND_LABELS[item.kind];
}

export function isGoogleImportedEvent(item: CalendarItem) {
  return item.externalProvider === "google" && item.syncStatus === "imported";
}

/** Libellé discret pour le statut de sync CRM → Google (hors imports). */
export function googlePushStatusLabel(item: CalendarItem): string | null {
  if (item.kind !== "event" || item.eventType !== "MEETING") {
    return null;
  }
  if (item.syncStatus === "imported") {
    return null;
  }
  if (item.syncStatus === "pushed") {
    return "Synchronisé avec Google";
  }
  if (item.syncStatus === "pending") {
    return "Sync Google en cours";
  }
  if (item.syncStatus?.startsWith("error:")) {
    return "Erreur de sync Google";
  }
  return null;
}
