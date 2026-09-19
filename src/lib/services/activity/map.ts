import "server-only";

import { ACTIVITY_LABELS } from "@/lib/crm/activity-labels";
import type { RecentActivityItem } from "@/lib/queries/activity";
import {
  clampCollection,
  parseRecentActivity,
  type RecentActivityAgentDto,
  type RecentActivityDto,
} from "./schema";

export function mapRecentActivityItem(item: RecentActivityItem): RecentActivityAgentDto {
  return {
    id: item.id,
    action: item.action,
    label: ACTIVITY_LABELS[item.action] ?? item.action,
    entityType: item.entityType,
    createdAt: item.createdAt,
    actorName: item.actorName,
  };
}

export function mapRecentActivity(
  items: readonly RecentActivityItem[],
  limit: number,
): RecentActivityDto {
  return parseRecentActivity({
    items: clampCollection(items.map(mapRecentActivityItem), limit),
  });
}
