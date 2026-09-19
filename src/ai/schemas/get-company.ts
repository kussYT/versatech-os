import "server-only";

import { z } from "zod";
import { companyCompactSchema } from "@/lib/services/companies/schema";

/**
 * Tool input: unknown keys (`actorId`, `include`, …) are stripped — never trusted.
 * Output DTO = `CompanyService.getCompany` (`companyCompactSchema`).
 *
 * Missing company: the tool maps `null` → `NOT_FOUND` ("Entreprise introuvable."),
 * not `{ success: true, data: null }` (tools V1 §3.3).
 */
export const getCompanyInputSchema = z.object({
  companyId: z.string().min(1),
});

export { companyCompactSchema };

export type GetCompanyInput = z.infer<typeof getCompanyInputSchema>;
export type CompanyCompact = z.infer<typeof companyCompactSchema>;
