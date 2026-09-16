import "server-only";

import { endOfToday, startOfToday } from "@/lib/crm/form-data";
import { prisma } from "@/lib/db/prisma";

export type RecentActivityItem = {
  id: string;
  action: string;
  entityType: string;
  createdAt: string;
  actorName: string | null;
};

export async function getRecentActivity(limit = 8): Promise<RecentActivityItem[]> {
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

export async function getTodayInteractionCounts() {
  const range = { gte: startOfToday(), lte: endOfToday() };

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
            { direction: "INTERNAL" },
            { result: "OTHER" },
            { notes: "Visite terrain" },
          ],
        },
      },
    }),
  ]);

  return { calls, meetings };
}
