import "server-only";

import type { SessionUser } from "@/lib/auth/types";
import type { CompanyLifecycle, CompanySearchDto } from "@/lib/services/companies/schema";
import type { ToolRuntime } from "@/ai/context";
import { toolFailure, toolSuccess, type ToolResult } from "@/ai/result";
import type { SearchCompaniesInput } from "@/ai/schemas/search-companies";

export type SearchCompaniesFn = (input: {
  actor: SessionUser;
  query: string;
  lifecycle?: CompanyLifecycle;
  city?: string;
  limit?: number;
}) => Promise<CompanySearchDto>;

async function defaultSearchCompanies(input: {
  actor: SessionUser;
  query: string;
  lifecycle?: CompanyLifecycle;
  city?: string;
  limit?: number;
}): Promise<CompanySearchDto> {
  const { CompanyService } = await import("@/lib/services/companies");
  return CompanyService.searchCompanies({
    actor: input.actor,
    query: input.query,
    lifecycle: input.lifecycle,
    city: input.city,
    limit: input.limit,
  });
}

/**
 * READ tool: `CompanyService.searchCompanies`.
 * Actor is `runtime.actor` only. Empty hits are success (`items: []`).
 */
export async function executeSearchCompanies(
  runtime: ToolRuntime,
  input: SearchCompaniesInput,
  search: SearchCompaniesFn = defaultSearchCompanies,
): Promise<ToolResult<CompanySearchDto>> {
  try {
    const data = await search({
      actor: runtime.actor,
      query: input.query,
      lifecycle: input.lifecycle,
      city: input.city,
      limit: input.limit,
    });
    return toolSuccess(data);
  } catch {
    return toolFailure("INTERNAL");
  }
}
