import "server-only";

import type { SessionUser } from "@/lib/auth/types";
import type { TodayTourDto } from "@/lib/services/tours/schema";
import type { ToolRuntime } from "@/ai/context";
import { toolFailure, toolSuccess, type ToolResult } from "@/ai/result";
import type { GetTodayTourInput } from "@/ai/schemas/get-today-tour";

export type GetTodayTourFn = (input: { actor: SessionUser }) => Promise<TodayTourDto | null>;

async function defaultGetTodayTour(input: { actor: SessionUser }): Promise<TodayTourDto | null> {
  const { TourService } = await import("@/lib/services/tours");
  return TourService.getTodayTour({ actor: input.actor });
}

/**
 * READ tool: `TourService.getTodayTour`.
 * Ignores untrusted `now`. No Tour row → success with `data: null`.
 */
export async function executeGetTodayTour(
  runtime: ToolRuntime,
  _input: GetTodayTourInput,
  getTour: GetTodayTourFn = defaultGetTodayTour,
): Promise<ToolResult<TodayTourDto | null>> {
  try {
    const data = await getTour({ actor: runtime.actor });
    return toolSuccess(data);
  } catch {
    return toolFailure("INTERNAL");
  }
}
