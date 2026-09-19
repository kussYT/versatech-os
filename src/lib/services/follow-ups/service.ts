import "server-only";

import type { SessionUser } from "@/lib/auth/types";
import { endOfToday, startOfToday } from "@/lib/dates";
import { loadCompanyExists } from "@/lib/queries/companies";
import { loadFollowUpItems, type FollowUpListItem } from "@/lib/queries/follow-ups";
import { mapFollowUpList } from "./map";
import {
  PENDING_FOLLOW_UP_BUCKETS,
  parseListFollowUpsInput,
  requireServiceActor,
  type FollowUpBucket,
  type FollowUpListDto,
  type PendingFollowUpBucket,
} from "./schema";

export type ListFollowUpsInput = {
  actor: SessionUser;
  bucket?: FollowUpBucket;
  companyId?: string;
  limit?: number;
  now?: Date;
};

async function loadPendingBucket(
  bucket: PendingFollowUpBucket,
  companyId: string | undefined,
  take: number,
  now: Date,
): Promise<FollowUpListItem[]> {
  const start = startOfToday(now);
  const end = endOfToday(now);
  const dueAt =
    bucket === "overdue"
      ? { lt: start }
      : bucket === "today"
        ? { gte: start, lte: end }
        : { gt: end };

  return loadFollowUpItems({
    status: "PENDING",
    companyId,
    dueAt,
    take,
  });
}

/**
 * Relances overdue / today / upcoming (Europe/Paris), optionnellement filtrées
 * par entreprise. SQL `take` — pas un dump du board UI.
 * READ only — no redirect, no ActivityLog.
 */
export async function listFollowUps({
  actor,
  bucket,
  companyId,
  limit,
  now = new Date(),
}: ListFollowUpsInput): Promise<FollowUpListDto> {
  requireServiceActor(actor);
  const input = parseListFollowUpsInput({ bucket, companyId, limit });

  if (input.companyId) {
    const exists = await loadCompanyExists(input.companyId);
    if (!exists) {
      throw new Error("Entreprise introuvable.");
    }
  }

  if (input.bucket === "completed") {
    const items = await loadFollowUpItems({
      status: "COMPLETED",
      companyId: input.companyId,
      take: input.limit,
    });
    return mapFollowUpList(
      items.map((item) => ({ item, bucket: "completed" as const })),
      input.limit,
    );
  }

  const buckets: PendingFollowUpBucket[] = input.bucket
    ? [input.bucket]
    : [...PENDING_FOLLOW_UP_BUCKETS];

  const collected: Array<{ item: FollowUpListItem; bucket: FollowUpBucket }> = [];

  for (const current of buckets) {
    const remaining = input.limit - collected.length;
    if (remaining <= 0) {
      break;
    }

    const rows = await loadPendingBucket(current, input.companyId, remaining, now);
    for (const item of rows) {
      collected.push({ item, bucket: current });
    }
  }

  return mapFollowUpList(collected, input.limit);
}

export const FollowUpService = {
  listFollowUps,
};
