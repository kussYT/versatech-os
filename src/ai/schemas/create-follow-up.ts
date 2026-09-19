import "server-only";

import { z } from "zod";
import { UNTRUSTED_TEXT_MAX_CHARS, isoDateTimeStringSchema } from "./common";

export const CREATE_FOLLOW_UP_DEFAULT_TITLE = "Relance";

/**
 * WRITE input. Unknown keys (`actorId`, `now`, `confirmation`) are stripped.
 * `dueAt` is an instant ISO — the agent must resolve « demain » / « lundi »
 * to Europe/Paris before calling.
 */
export const createFollowUpInputSchema = z.object({
  companyId: z.string().min(1),
  dueAt: isoDateTimeStringSchema,
  title: z
    .string()
    .trim()
    .min(1)
    .max(UNTRUSTED_TEXT_MAX_CHARS)
    .default(CREATE_FOLLOW_UP_DEFAULT_TITLE),
});

export const createFollowUpOutputSchema = z.object({
  followUpId: z.string().min(1),
});

export type CreateFollowUpInput = z.infer<typeof createFollowUpInputSchema>;
export type CreateFollowUpOutput = z.infer<typeof createFollowUpOutputSchema>;
