import "server-only";

import { requireAuthenticatedUser } from "@/lib/auth/dal";

import { endOfToday, startOfToday } from "@/lib/crm/form-data";
import { prisma } from "@/lib/db/prisma";
import {
  VISIT_INTERACTION_DIRECTION,
  VISIT_INTERACTION_RESULT,
  VISIT_NOTES,
} from "@/lib/prospection/visit";

export type RecentActivityItem = {
  id: string;
  action: string;
  entityType: string;
  createdAt: string;
  actorName: string | null;
};

/** Caller must authenticate. Does not select ActivityLog.metadata. */
export async function loadRecentActivity(limit = 8): Promise<RecentActivityItem[]> {
  const logs = await prisma.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      action: true,
      entityType: true,
      createdAt: true,
      actor: { select: { name: true } },
    },
  });

  return logs.map((log) => ({
    id: log.id,
    action: log.action,
    entityType: log.entityType,
    createdAt: log.createdAt.toISOString(),
    actorName: log.actor?.name ?? null,
  }));
}

export async function getRecentActivity(limit = 8): Promise<RecentActivityItem[]> {
  await requireAuthenticatedUser();
  return loadRecentActivity(limit);
}

/** Caller must authenticate. Meetings exclude terrain visits (isTerrainVisit). */
export async function loadTodayInteractionCounts(now = new Date()) {
  const range = { gte: startOfToday(now), lte: endOfToday(now) };

  const [calls, meetings] = await Promise.all([
    prisma.interaction.count({
      where: { type: "CALL", occurredAt: range },
    }),
    prisma.interaction.count({
      where: {
        type: "MEETING",
        occurredAt: range,
        NOT: {
          AND: [
            { direction: VISIT_INTERACTION_DIRECTION },
            { result: VISIT_INTERACTION_RESULT },
            { notes: VISIT_NOTES },
          ],
        },
      },
    }),
  ]);

  return { calls, meetings };
}

export async function getTodayInteractionCounts() {
  await requireAuthenticatedUser();
  return loadTodayInteractionCounts();
}
