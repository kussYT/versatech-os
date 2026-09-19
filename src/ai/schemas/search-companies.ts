import "server-only";

import { z } from "zod";
import {
  COMPANY_LIFECYCLES,
  SEARCH_COMPANIES_LIMITS,
  companySearchHitSchema,
  companySearchSchema,
} from "@/lib/services/companies/schema";

/**
 * Tool input: unknown keys (`actorId`, `now`, …) are stripped — never trusted.
 * Output DTO = `CompanyService.searchCompanies` (`companySearchSchema`).
 */
export const searchCompaniesInputSchema = z.object({
  query: z.string().trim().min(2).max(80),
  lifecycle: z.enum(COMPANY_LIFECYCLES).optional(),
  city: z.string().trim().min(1).max(80).optional(),
  limit: z.number().int().min(1).max(SEARCH_COMPANIES_LIMITS.max).default(SEARCH_COMPANIES_LIMITS.default),
});

export const searchCompaniesOutputSchema = companySearchSchema;

export { companySearchHitSchema };

export type SearchCompaniesInput = z.infer<typeof searchCompaniesInputSchema>;
export type CompanySearchHit = z.infer<typeof companySearchHitSchema>;
export type SearchCompaniesOutput = z.infer<typeof searchCompaniesOutputSchema>;
