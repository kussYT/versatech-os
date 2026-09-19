import "server-only";

import type { SessionUser } from "@/lib/auth/types";
import type { TodayOverview } from "@/lib/services/today/schema";
import type { ToolRuntime } from "@/ai/context";
import { toolFailure, toolSuccess, type ToolResult } from "@/ai/result";
import type { GetTodayOverviewInput } from "@/ai/schemas/get-today-overview";

export type GetTodayOverviewFn = (input: { actor: SessionUser }) => Promise<TodayOverview>;

async function defaultGetTodayOverview(input: { actor: SessionUser }): Promise<TodayOverview> {
  const { TodayService } = await import("@/lib/services/today");
  return TodayService.getTodayOverview({ actor: input.actor });
}

/**
 * READ tool: briefing du jour civil Europe/Paris.
 * Ignores untrusted `now` / `actorId` (stripped by the input schema).
 * Passes `runtime.actor` to the service — never ToolContext.
 */
export async function executeGetTodayOverview(
  runtime: ToolRuntime,
  _input: GetTodayOverviewInput,
  getOverview: GetTodayOverviewFn = defaultGetTodayOverview,
): Promise<ToolResult<TodayOverview>> {
  try {
    const data = await getOverview({ actor: runtime.actor });
    return toolSuccess(data);
  } catch {
    return toolFailure("INTERNAL");
  }
}
