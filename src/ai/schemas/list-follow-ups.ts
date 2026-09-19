import "server-only";

import { z } from "zod";
import {
  FOLLOW_UP_BUCKETS,
  LIST_FOLLOW_UPS_LIMITS,
  followUpAgentSchema,
  followUpListSchema,
} from "@/lib/services/follow-ups/schema";

/**
 * Tool input: unknown keys (`actorId`, `now`, …) are stripped — never trusted.
 * Civil `now` is server-side (Europe/Paris). Output DTO = `FollowUpService.listFollowUps`.
 *
 * Unknown `companyId` → service throws; the tool maps `NOT_FOUND`.
 */
export const listFollowUpsInputSchema = z.object({
  bucket: z.enum(FOLLOW_UP_BUCKETS).optional(),
  companyId: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(LIST_FOLLOW_UPS_LIMITS.max).default(LIST_FOLLOW_UPS_LIMITS.default),
});

export const listFollowUpsOutputSchema = followUpListSchema;

export { followUpAgentSchema };

export type ListFollowUpsInput = z.infer<typeof listFollowUpsInputSchema>;
export type FollowUpAgent = z.infer<typeof followUpAgentSchema>;
export type ListFollowUpsOutput = z.infer<typeof listFollowUpsOutputSchema>;
