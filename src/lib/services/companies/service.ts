import "server-only";

import type { SessionUser } from "@/lib/auth/types";
import { normalizeSearchQuery } from "@/lib/crm/search";
import { loadCompanyCompact } from "@/lib/queries/companies";
import { loadFinanceSnapshot } from "@/lib/queries/payments";
import { loadMatchingCompanies } from "@/lib/queries/search";
import { mapCompanyCompact, mapCompanySearch } from "./map";
import {
  getCompanyInputSchema,
  parseSearchCompaniesInput,
  requireServiceActor,
  type CompanyCompact,
  type CompanyLifecycle,
  type CompanySearchDto,
} from "./schema";

export type SearchCompaniesInput = {
  actor: SessionUser;
  query: string;
  lifecycle?: CompanyLifecycle;
  city?: string;
  limit?: number;
};

export type GetCompanyInput = {
  actor: SessionUser;
  companyId: string;
};

/**
 * Recherche d'entreprises (ids CRM, pas de href).
 * Réutilise le loader texte de `SearchService.searchWorkspace` (`loadMatchingCompanies`).
 * READ only — no redirect, no ActivityLog.
 */
export async function searchCompanies({
  actor,
  query,
  lifecycle,
  city,
  limit,
}: SearchCompaniesInput): Promise<CompanySearchDto> {
  requireServiceActor(actor);
  const input = parseSearchCompaniesInput({ query, lifecycle, city, limit });
  const rows = await loadMatchingCompanies({
    query: input.query,
    lifecycle: input.lifecycle,
    city: input.city,
    take: input.limit,
  });

  return mapCompanySearch(rows, normalizeSearchQuery(input.query), input.limit);
}

/**
 * Fiche compacte — pas le hub `getCompanyDetail`.
 * Absent → `null` (le tool mappe NOT_FOUND).
 */
export async function getCompany({
  actor,
  companyId,
}: GetCompanyInput): Promise<CompanyCompact | null> {
  requireServiceActor(actor);
  const input = getCompanyInputSchema.parse({ companyId });
  const [loaded, finance] = await Promise.all([
    loadCompanyCompact(input.companyId),
    loadFinanceSnapshot({ companyId: input.companyId }),
  ]);

  if (!loaded) {
    return null;
  }

  return mapCompanyCompact(loaded, finance);
}

export const CompanyService = {
  searchCompanies,
  getCompany,
};
