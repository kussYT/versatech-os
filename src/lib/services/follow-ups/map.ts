import "server-only";

import type { FollowUpListItem } from "@/lib/queries/follow-ups";
import {
  clampCollection,
  parseFollowUpList,
  type FollowUpAgentDto,
  type FollowUpBucket,
  type FollowUpListDto,
} from "./schema";

export function mapFollowUpAgent(item: FollowUpListItem, bucket: FollowUpBucket): FollowUpAgentDto {
  return {
    id: item.id,
    title: item.title,
    dueAt: item.dueAt,
    status: item.status,
    completedAt: item.completedAt,
    bucket,
    company: {
      id: item.company.id,
      name: item.company.name,
    },
    lastInteraction: item.lastInteraction,
  };
}

export function mapFollowUpList(
  items: Array<{ item: FollowUpListItem; bucket: FollowUpBucket }>,
  limit: number,
): FollowUpListDto {
  const mapped = clampCollection(
    items.map(({ item, bucket }) => mapFollowUpAgent(item, bucket)),
    limit,
  );

  return parseFollowUpList({
    items: mapped,
    returned: mapped.length,
    limit,
  });
}
