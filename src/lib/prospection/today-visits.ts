import "server-only";

import { prisma } from "@/lib/db/prisma";
import { tourCivilKeyFor, tourDateFor, unvisitedCompanyIds } from "@/lib/prospection/tour";

/**
 * Map “À visiter aujourd’hui”.
 * Company IDs on the Europe/Paris civil-day tour that are not yet visited, in tour order.
 * Empty array if no tour exists for that day.
 */
export async function getTodayVisitCompanyIds(now = new Date()): Promise<string[]> {
  const date = tourDateFor(now);
  const tour = await prisma.tour.findUnique({
    where: { date },
    include: {
      stops: {
        orderBy: { order: "asc" },
        select: { companyId: true, order: true, visitedAt: true },
      },
    },
  });

  if (!tour) {
    return [];
  }

  void tourCivilKeyFor(now);
  return unvisitedCompanyIds(tour.stops);
}

export { tourCivilKeyFor, tourDateFor };
