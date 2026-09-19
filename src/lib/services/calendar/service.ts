import "server-only";

import type { SessionUser } from "@/lib/auth/types";
import { endOfParisDay, startOfParisDay } from "@/lib/dates";
import { loadCalendarItems } from "@/lib/queries/calendar";
import { mapCalendarList } from "./map";
import {
  isCalendarRangeTooLarge,
  parseListCalendarItemsInput,
  RANGE_TOO_LARGE_MESSAGE,
  requireServiceActor,
  type CalendarListDto,
} from "./schema";

export type ListCalendarItemsInput = {
  actor: SessionUser;
  from: string;
  to: string;
  limit?: number;
  now?: Date;
};

/**
 * Planning fusionné (events, relances, tâches, projets, jalons, TourStops).
 * Visites terrain = `kind: terrain_visit`, jamais un CalendarEvent / RDV commercial.
 * READ only — no redirect, no ActivityLog. Borne après merge (déjà trié).
 */
export async function listCalendarItems({
  actor,
  from,
  to,
  limit,
  now = new Date(),
}: ListCalendarItemsInput): Promise<CalendarListDto> {
  requireServiceActor(actor);
  const input = parseListCalendarItemsInput({ from, to, limit });

  if (isCalendarRangeTooLarge(input.from, input.to)) {
    throw new Error(RANGE_TOO_LARGE_MESSAGE);
  }

  const items = await loadCalendarItems(
    startOfParisDay(input.from),
    endOfParisDay(input.to),
    now,
  );

  return mapCalendarList(items, input.from, input.to, input.limit);
}

export const CalendarService = {
  listCalendarItems,
};
