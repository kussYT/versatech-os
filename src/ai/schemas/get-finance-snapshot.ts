import "server-only";

import { z } from "zod";
import { financeSnapshotSchema } from "@/lib/services/finance/schema";

/**
 * Tool input: unknown keys (`actorId`, `now`, …) are stripped — never trusted.
 * Output DTO = `FinanceService.getFinanceSnapshot` (READ agrégats, pas CRITICAL).
 */
export const getFinanceSnapshotInputSchema = z.object({
  companyId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
});

export const getFinanceSnapshotOutputSchema = financeSnapshotSchema;

export type GetFinanceSnapshotInput = z.infer<typeof getFinanceSnapshotInputSchema>;
export type GetFinanceSnapshotOutput = z.infer<typeof getFinanceSnapshotOutputSchema>;
