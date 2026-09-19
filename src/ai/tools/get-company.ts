import "server-only";

import type { SessionUser } from "@/lib/auth/types";
import type { CompanyCompact } from "@/lib/services/companies/schema";
import type { ToolRuntime } from "@/ai/context";
import { toolFailure, toolSuccess, type ToolResult } from "@/ai/result";
import type { GetCompanyInput } from "@/ai/schemas/get-company";
import { COMPANY_NOT_FOUND_MESSAGE } from "./service-errors";

export type GetCompanyFn = (input: {
  actor: SessionUser;
  companyId: string;
}) => Promise<CompanyCompact | null>;

async function defaultGetCompany(input: {
  actor: SessionUser;
  companyId: string;
}): Promise<CompanyCompact | null> {
  const { CompanyService } = await import("@/lib/services/companies");
  return CompanyService.getCompany({
    actor: input.actor,
    companyId: input.companyId,
  });
}

/**
 * READ tool: `CompanyService.getCompany`.
 * `null` from the service → `NOT_FOUND` (not success with `data: null`).
 */
export async function executeGetCompany(
  runtime: ToolRuntime,
  input: GetCompanyInput,
  getCompany: GetCompanyFn = defaultGetCompany,
): Promise<ToolResult<CompanyCompact>> {
  try {
    const data = await getCompany({
      actor: runtime.actor,
      companyId: input.companyId,
    });
    if (data === null) {
      return toolFailure("NOT_FOUND", COMPANY_NOT_FOUND_MESSAGE);
    }
    return toolSuccess(data);
  } catch {
    return toolFailure("INTERNAL");
  }
}
