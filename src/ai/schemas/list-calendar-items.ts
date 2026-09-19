import "server-only";

import { z } from "zod";
import {
  LIST_CALENDAR_LIMITS,
  calendarItemAgentSchema,
  calendarListSchema,
  civilDateStringSchema,
} from "@/lib/services/calendar/schema";

/**
 * Tool input: unknown keys (`actorId`, `now`, …) are stripped — never trusted.
 * `from`/`to` = jours civils Paris. Output DTO = `CalendarService.listCalendarItems`.
 */
export const listCalendarItemsInputSchema = z
  .object({
    from: civilDateStringSchema,
    to: civilDateStringSchema,
    limit: z
      .number()
      .int()
      .min(1)
      .max(LIST_CALENDAR_LIMITS.max)
      .default(LIST_CALENDAR_LIMITS.default),
  })
  .superRefine((value, ctx) => {
    if (value.from > value.to) {
      ctx.addIssue({
        code: "custom",
        message: "from doit être ≤ to.",
        path: ["from"],
      });
    }
  });

export const listCalendarItemsOutputSchema = calendarListSchema;

export { calendarItemAgentSchema };

export type ListCalendarItemsInput = z.infer<typeof listCalendarItemsInputSchema>;
export type ListCalendarItemsOutput = z.infer<typeof listCalendarItemsOutputSchema>;
