import "server-only";

import { prisma } from "@/lib/db/prisma";
import { tourDateFor } from "@/lib/prospection/tour";

export type TourStopItem = {
  id: string;
  order: number;
  visitedAt: string | null;
  company: {
    id: string;
    name: string;
    lifecycleStatus: "LEAD" | "CONTACTED" | "QUALIFIED" | "OPPORTUNITY" | "CLIENT" | "INACTIVE" | "LOST";
    address: string | null;
    city: string | null;
    postalCode: string | null;
    country: string | null;
    phone: string | null;
    latitude: number | null;
    longitude: number | null;
  };
};

export type TodayTour = {
  id: string;
  date: string;
  stops: TourStopItem[];
};

export async function getTodayTour(): Promise<TodayTour | null> {
  const date = tourDateFor();
  const tour = await prisma.tour.findUnique({
    where: { date },
    include: {
      stops: {
        orderBy: { order: "asc" },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              lifecycleStatus: true,
              address: true,
              city: true,
              postalCode: true,
              country: true,
              phone: true,
              latitude: true,
              longitude: true,
            },
          },
        },
      },
    },
  });

  if (!tour) {
    return null;
  }

  return {
    id: tour.id,
    date: tour.date.toISOString(),
    stops: tour.stops.map((stop) => ({
      id: stop.id,
      order: stop.order,
      visitedAt: stop.visitedAt?.toISOString() ?? null,
      company: stop.company,
    })),
  };
}

export type TourDashboard = {
  planned: number;
  visited: number;
  remaining: number;
  nextNames: string[];
};

export async function getTourDashboard(): Promise<TourDashboard> {
  const tour = await getTodayTour();
  if (!tour) {
    return { planned: 0, visited: 0, remaining: 0, nextNames: [] };
  }

  const visited = tour.stops.filter((stop) => stop.visitedAt).length;
  const remaining = tour.stops.length - visited;
  const nextNames = tour.stops
    .filter((stop) => !stop.visitedAt)
    .slice(0, 3)
    .map((stop) => stop.company.name);

  return {
    planned: tour.stops.length,
    visited,
    remaining,
    nextNames,
  };
}

export async function listCompaniesForTourPicker() {
  return prisma.company.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, city: true, lifecycleStatus: true },
    take: 200,
  });
}
