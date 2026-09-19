import "server-only";

import type { TodayTour, TourStopItem } from "@/lib/queries/tours";
import {
  parseTodayTour,
  TODAY_TOUR_STOP_LIMIT,
  type TodayTourDto,
  type TodayTourStopDto,
} from "./schema";

function mapStop(stop: TourStopItem): TodayTourStopDto {
  return {
    id: stop.id,
    order: stop.order,
    visitedAt: stop.visitedAt,
    company: {
      id: stop.company.id,
      name: stop.company.name,
      lifecycleStatus: stop.company.lifecycleStatus,
      address: stop.company.address,
      city: stop.company.city,
      postalCode: stop.company.postalCode,
      country: stop.company.country,
      phone: stop.company.phone,
    },
  };
}

export function mapTodayTour(tour: TodayTour | null): TodayTourDto | null {
  if (!tour) {
    return null;
  }

  const visited = tour.stops.filter((stop) => stop.visitedAt).length;
  const truncated = tour.stops.length > TODAY_TOUR_STOP_LIMIT;
  const stops = (truncated ? tour.stops.slice(0, TODAY_TOUR_STOP_LIMIT) : tour.stops).map(mapStop);

  return parseTodayTour({
    id: tour.id,
    date: tour.date,
    planned: tour.stops.length,
    visited,
    remaining: tour.stops.length - visited,
    truncated,
    stops,
  });
}
