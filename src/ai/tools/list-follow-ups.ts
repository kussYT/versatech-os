import "server-only";

import type { SessionUser } from "@/lib/auth/types";
import type { FollowUpBucket, FollowUpListDto } from "@/lib/services/follow-ups/schema";
import type { ToolRuntime } from "@/ai/context";
import { toolFailure, toolSuccess, type ToolResult } from "@/ai/result";
import type { ListFollowUpsInput } from "@/ai/schemas/list-follow-ups";
import { COMPANY_NOT_FOUND_MESSAGE, isCompanyNotFoundError } from "./service-errors";

export type ListFollowUpsFn = (input: {
  actor: SessionUser;
  bucket?: FollowUpBucket;
  companyId?: string;
  limit?: number;
}) => Promise<FollowUpListDto>;

async function defaultListFollowUps(input: {
  actor: SessionUser;
  bucket?: FollowUpBucket;
  companyId?: string;
  limit?: number;
}): Promise<FollowUpListDto> {
  const { FollowUpService } = await import("@/lib/services/follow-ups");
  return FollowUpService.listFollowUps({
    actor: input.actor,
    bucket: input.bucket,
    companyId: input.companyId,
    limit: input.limit,
  });
}

/**
 * READ tool: `FollowUpService.listFollowUps`.
 * Does not pass model `now`. Unknown `companyId` → `NOT_FOUND`.
 * Empty board → success with `items: []`.
 */
export async function executeListFollowUps(
  runtime: ToolRuntime,
  input: ListFollowUpsInput,
  listFollowUps: ListFollowUpsFn = defaultListFollowUps,
): Promise<ToolResult<FollowUpListDto>> {
  try {
    const data = await listFollowUps({
      actor: runtime.actor,
      bucket: input.bucket,
      companyId: input.companyId,
      limit: input.limit,
    });
    return toolSuccess(data);
  } catch (error) {
    if (isCompanyNotFoundError(error)) {
      return toolFailure("NOT_FOUND", COMPANY_NOT_FOUND_MESSAGE);
    }
    return toolFailure("INTERNAL");
  }
}
