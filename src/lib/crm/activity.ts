import "server-only";

import { prisma } from "@/lib/db/prisma";

type LogActivityInput = {
  actorId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export async function logActivity(input: LogActivityInput) {
  await prisma.activityLog.create({
    data: {
      actorId: input.actorId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      metadata: input.metadata,
    },
  });
}
