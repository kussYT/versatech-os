import "server-only";

import { z } from "zod";

/**
 * WRITE input. Unknown keys (`actorId`, `confirmation`) are stripped.
 * Completes a persisted PENDING follow-up by id.
 */
export const completeFollowUpInputSchema = z.object({
  followUpId: z.string().min(1),
});

export const completeFollowUpOutputSchema = z.object({
  followUpId: z.string().min(1),
});

export type CompleteFollowUpInput = z.infer<typeof completeFollowUpInputSchema>;
export type CompleteFollowUpOutput = z.infer<typeof completeFollowUpOutputSchema>;
