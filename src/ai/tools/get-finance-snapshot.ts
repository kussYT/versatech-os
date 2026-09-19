import "server-only";

import type { SessionUser } from "@/lib/auth/types";
import type { FinanceSnapshotDto } from "@/lib/services/finance/schema";
import type { ToolRuntime } from "@/ai/context";
import { toolFailure, toolSuccess, type ToolResult } from "@/ai/result";
import type { GetFinanceSnapshotInput } from "@/ai/schemas/get-finance-snapshot";
import {
  COMPANY_NOT_FOUND_MESSAGE,
  isCompanyNotFoundError,
  isProjectNotFoundError,
  PROJECT_NOT_FOUND_MESSAGE,
} from "./service-errors";

export type GetFinanceSnapshotFn = (input: {
  actor: SessionUser;
  companyId?: string;
  projectId?: string;
}) => Promise<FinanceSnapshotDto>;

async function defaultGetFinanceSnapshot(input: {
  actor: SessionUser;
  companyId?: string;
  projectId?: string;
}): Promise<FinanceSnapshotDto> {
  const { FinanceService } = await import("@/lib/services/finance");
  return FinanceService.getFinanceSnapshot({
    actor: input.actor,
    companyId: input.companyId,
    projectId: input.projectId,
  });
}

/**
 * READ tool: `FinanceService.getFinanceSnapshot`.
 * Agrégats only — never a payment write. Unknown scope id → `NOT_FOUND`.
 */
export async function executeGetFinanceSnapshot(
  runtime: ToolRuntime,
  input: GetFinanceSnapshotInput,
  getSnapshot: GetFinanceSnapshotFn = defaultGetFinanceSnapshot,
): Promise<ToolResult<FinanceSnapshotDto>> {
  try {
    const data = await getSnapshot({
      actor: runtime.actor,
      companyId: input.companyId,
      projectId: input.projectId,
    });
    return toolSuccess(data);
  } catch (error) {
    if (isCompanyNotFoundError(error)) {
      return toolFailure("NOT_FOUND", COMPANY_NOT_FOUND_MESSAGE);
    }
    if (isProjectNotFoundError(error)) {
      return toolFailure("NOT_FOUND", PROJECT_NOT_FOUND_MESSAGE);
    }
    return toolFailure("INTERNAL");
  }
}
