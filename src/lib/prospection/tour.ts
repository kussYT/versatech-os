import { parisDateKey, startOfToday } from "@/lib/dates";

export type TourStopDraft = {
  companyId: string;
  order: number;
  visitedAt: Date | string | null;
};

export function tourDateFor(now = new Date()) {
  return startOfToday(now);
}

export function tourCivilKeyFor(now = new Date()) {
  return parisDateKey(now);
}

export function addCompanyToStops(stops: TourStopDraft[], companyId: string): TourStopDraft[] {
  if (stops.some((stop) => stop.companyId === companyId)) {
    return stops;
  }

  const nextOrder = stops.reduce((max, stop) => Math.max(max, stop.order), 0) + 1;
  return [...stops, { companyId, order: nextOrder, visitedAt: null }];
}

export function removeCompanyFromStops(stops: TourStopDraft[], companyId: string): TourStopDraft[] {
  return resequenceStops(stops.filter((stop) => stop.companyId !== companyId));
}

export function resequenceStops(stops: TourStopDraft[]): TourStopDraft[] {
  return [...stops]
    .sort((a, b) => a.order - b.order)
    .map((stop, index) => ({ ...stop, order: index + 1 }));
}

export function moveStop(stops: TourStopDraft[], companyId: string, direction: -1 | 1): TourStopDraft[] {
  const ordered = resequenceStops(stops);
  const index = ordered.findIndex((stop) => stop.companyId === companyId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= ordered.length) {
    return ordered;
  }

  const copy = [...ordered];
  const current = copy[index];
  copy[index] = copy[nextIndex];
  copy[nextIndex] = current;
  return copy.map((stop, i) => ({ ...stop, order: i + 1 }));
}

export function markStopVisited(
  stops: TourStopDraft[],
  companyId: string,
  visitedAt = new Date(),
): TourStopDraft[] {
  return stops.map((stop) =>
    stop.companyId === companyId ? { ...stop, visitedAt } : stop,
  );
}

export function unvisitedCompanyIds(stops: TourStopDraft[]) {
  return resequenceStops(stops)
    .filter((stop) => !stop.visitedAt)
    .map((stop) => stop.companyId);
}

export function todayVisitCompanyIdsFromStops(
  tourDateKey: string,
  todayKey: string,
  stops: TourStopDraft[],
) {
  if (tourDateKey !== todayKey) {
    return [];
  }

  return unvisitedCompanyIds(stops);
}
