import "server-only";

import type { SessionUser } from "@/lib/auth/types";
import type { CalendarListDto } from "@/lib/services/calendar/schema";
import type { ToolRuntime } from "@/ai/context";
import { toolFailure, toolSuccess, type ToolResult } from "@/ai/result";
import type { ListCalendarItemsInput } from "@/ai/schemas/list-calendar-items";
import { isRangeTooLargeError } from "./service-errors";

export type ListCalendarItemsFn = (input: {
  actor: SessionUser;
  from: string;
  to: string;
  limit?: number;
}) => Promise<CalendarListDto>;

async function defaultListCalendarItems(input: {
  actor: SessionUser;
  from: string;
  to: string;
  limit?: number;
}): Promise<CalendarListDto> {
  const { CalendarService } = await import("@/lib/services/calendar");
  return CalendarService.listCalendarItems({
    actor: input.actor,
    from: input.from,
    to: input.to,
    limit: input.limit,
  });
}

/**
 * READ tool: `CalendarService.listCalendarItems`.
 * Does not pass model `now`. Fenêtre > 31 jours civils → `RANGE_TOO_LARGE`.
 */
export async function executeListCalendarItems(
  runtime: ToolRuntime,
  input: ListCalendarItemsInput,
  listCalendarItems: ListCalendarItemsFn = defaultListCalendarItems,
): Promise<ToolResult<CalendarListDto>> {
  try {
    const data = await listCalendarItems({
      actor: runtime.actor,
      from: input.from,
      to: input.to,
      limit: input.limit,
    });
    return toolSuccess(data);
  } catch (error) {
    if (isRangeTooLargeError(error)) {
      return toolFailure("RANGE_TOO_LARGE");
    }
    return toolFailure("INTERNAL");
  }
}
