import "server-only";

import { z } from "zod";
import {
  RECENT_ACTIVITY_LIMITS,
  recentActivityAgentSchema,
  recentActivityListSchema,
} from "@/lib/services/activity/schema";

/**
 * Tool input: unknown keys (`actorId`, `now`, …) are stripped — never trusted.
 * Output DTO = `ActivityService.getRecentActivity` (labels, jamais metadata).
 */
export const getRecentActivityInputSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(RECENT_ACTIVITY_LIMITS.max)
    .default(RECENT_ACTIVITY_LIMITS.default),
});

export const getRecentActivityOutputSchema = recentActivityListSchema;

export { recentActivityAgentSchema };

export type GetRecentActivityInput = z.infer<typeof getRecentActivityInputSchema>;
export type GetRecentActivityOutput = z.infer<typeof getRecentActivityOutputSchema>;
