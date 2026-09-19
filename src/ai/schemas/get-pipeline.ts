import "server-only";

import { z } from "zod";
import {
  PIPELINE_LIMITS,
  pipelineCardSchema,
  pipelineSchema,
} from "@/lib/services/opportunities/schema";

/**
 * Tool input: unknown keys (`actorId`, `now`, …) are stripped — never trusted.
 * Output DTO = `OpportunityService.getPipeline`.
 */
export const getPipelineInputSchema = z.object({
  openOnly: z.boolean().default(true),
  limitPerStage: z
    .number()
    .int()
    .min(1)
    .max(PIPELINE_LIMITS.maxPerStage)
    .default(PIPELINE_LIMITS.defaultPerStage),
});

export const getPipelineOutputSchema = pipelineSchema;

export { pipelineCardSchema };

export type GetPipelineInput = z.infer<typeof getPipelineInputSchema>;
export type GetPipelineOutput = z.infer<typeof getPipelineOutputSchema>;
