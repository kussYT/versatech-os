import "server-only";

import type { SessionUser } from "@/lib/auth/types";
import type { RecentActivityDto } from "@/lib/services/activity/schema";
import type { ToolRuntime } from "@/ai/context";
import { toolFailure, toolSuccess, type ToolResult } from "@/ai/result";
import type { GetRecentActivityInput } from "@/ai/schemas/get-recent-activity";

export type GetRecentActivityFn = (input: {
  actor: SessionUser;
  limit?: number;
}) => Promise<RecentActivityDto>;

async function defaultGetRecentActivity(input: {
  actor: SessionUser;
  limit?: number;
}): Promise<RecentActivityDto> {
  const { ActivityService } = await import("@/lib/services/activity");
  return ActivityService.getRecentActivity({
    actor: input.actor,
    limit: input.limit,
  });
}

/**
 * READ tool: `ActivityService.getRecentActivity`.
 * Labels only — never ActivityLog.metadata.
 */
export async function executeGetRecentActivity(
  runtime: ToolRuntime,
  input: GetRecentActivityInput,
  getRecent: GetRecentActivityFn = defaultGetRecentActivity,
): Promise<ToolResult<RecentActivityDto>> {
  try {
    const data = await getRecent({
      actor: runtime.actor,
      limit: input.limit,
    });
    return toolSuccess(data);
  } catch {
    return toolFailure("INTERNAL");
  }
}
