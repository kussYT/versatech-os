import "server-only";

import type { SessionUser } from "@/lib/auth/types";
import { loadRecentActivity } from "@/lib/queries/activity";
import { mapRecentActivity } from "./map";
import {
  parseGetRecentActivityInput,
  requireServiceActor,
  type RecentActivityDto,
} from "./schema";

export type GetRecentActivityInput = {
  actor: SessionUser;
  limit?: number;
};

/**
 * Journal métier récent : libellés `ACTIVITY_LABELS`, jamais `metadata`.
 * SQL `take`. READ only — no redirect, no ActivityLog write.
 */
export async function getRecentActivity({
  actor,
  limit,
}: GetRecentActivityInput): Promise<RecentActivityDto> {
  requireServiceActor(actor);
  const input = parseGetRecentActivityInput({ limit });
  const items = await loadRecentActivity(input.limit);
  return mapRecentActivity(items, input.limit);
}

export const ActivityService = {
  getRecentActivity,
};
