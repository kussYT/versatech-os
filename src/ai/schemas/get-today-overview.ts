import "server-only";

import { z } from "zod";
import { todayOverviewSchema } from "@/lib/services/today/schema";

/**
 * Input is empty. Civil "today" is computed server-side (Europe/Paris).
 * Unknown keys (`actorId`, `now`, `confirmation`, …) are stripped — never trusted.
 */
export const getTodayOverviewInputSchema = z.object({});

export const getTodayOverviewOutputSchema = todayOverviewSchema;

export type GetTodayOverviewInput = z.infer<typeof getTodayOverviewInputSchema>;
export type { TodayOverview as GetTodayOverviewOutput } from "@/lib/services/today/schema";
