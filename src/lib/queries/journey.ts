import "server-only";

import type { JourneyBoard } from "@/lib/crm/journey-cursor";
import { prisma } from "@/lib/db/prisma";

export type { JourneyBoard } from "@/lib/crm/journey-cursor";

function missingJourneyTable(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }
  return error.code === "P2021" || error.code === "P2022";
}

/** Lecture seule. Si la migration n'est pas encore appliquée, la fiche reste utilisable. */
export async function loadJourneyBoard(companyId: string): Promise<JourneyBoard> {
  try {
    const [cursors, events] = await Promise.all([
      prisma.journeyCursor.findMany({
        where: { companyId },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.journeyCursorEvent.findMany({
        where: { companyId },
        orderBy: { changedAt: "desc" },
        take: 20,
      }),
    ]);
    return {
      schemaReady: true,
      cursors: cursors.map((cursor) => ({
        contextKey: cursor.contextKey,
        step: cursor.step,
        updatedAt: cursor.updatedAt.toISOString(),
      })),
      events: events.flatMap((event) => {
        if (event.action !== "set" && event.action !== "reset" && event.action !== "adopt") {
          return [];
        }
        return [
          {
            id: event.id,
            contextKey: event.contextKey,
            fromStep: event.fromStep,
            toStep: event.toStep,
            action: event.action,
            changedAt: event.changedAt.toISOString(),
          },
        ];
      }),
    };
  } catch (error) {
    if (missingJourneyTable(error)) {
      return { schemaReady: false, cursors: [], events: [] };
    }
    throw error;
  }
}
