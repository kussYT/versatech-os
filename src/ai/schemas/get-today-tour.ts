import "server-only";

import { z } from "zod";
import { todayTourSchema } from "@/lib/services/tours/schema";

/**
 * Input is empty. Civil "today" is computed server-side (Europe/Paris).
 * Unknown keys (`actorId`, `now`, …) are stripped — never trusted.
 * No Tour row → tool success with `data: null` (not NOT_FOUND).
 */
export const getTodayTourInputSchema = z.object({});

export const getTodayTourOutputSchema = todayTourSchema.nullable();

export type GetTodayTourInput = z.infer<typeof getTodayTourInputSchema>;
export type { TodayTourDto as GetTodayTourOutput } from "@/lib/services/tours/schema";
