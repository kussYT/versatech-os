import type { CompanyLifecycle } from "@/generated/prisma/client";
import { formatCompanyAddress, hasUsableCoordinates } from "./itinerary";

export { formatCompanyAddress, hasUsableCoordinates };

export const MAP_FILTERS = [
  "all",
  "to_prospect",
  "in_progress",
  "clients",
  "lost",
  "inactive",
  "today_visits",
] as const;

export type MapFilter = (typeof MAP_FILTERS)[number];

export const MAP_FILTER_LABELS: Record<MapFilter, string> = {
  all: "Tous",
  to_prospect: "À prospecter",
  in_progress: "En cours",
  clients: "Clients",
  lost: "Perdus",
  inactive: "Inactifs",
  today_visits: "À visiter aujourd'hui",
};

export type MapMarkerColor = "blue" | "orange" | "green" | "red" | "gray";

export const MAP_MARKER_HEX: Record<MapMarkerColor, string> = {
  blue: "#4c7dff",
  orange: "#fb923c",
  green: "#34d399",
  red: "#fb7185",
  gray: "#66738c",
};

export type MapCompany = {
  id: string;
  name: string;
  lifecycleStatus: CompanyLifecycle;
  industry: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  nextFollowUpTitle: string | null;
  nextFollowUpAt: string | null;
};

export function markerColorForLifecycle(status: CompanyLifecycle): MapMarkerColor {
  if (status === "LEAD") {
    return "blue";
  }
  if (status === "CONTACTED" || status === "QUALIFIED" || status === "OPPORTUNITY") {
    return "orange";
  }
  if (status === "CLIENT") {
    return "green";
  }
  if (status === "LOST") {
    return "red";
  }
  return "gray";
}

export function needsLocation(company: Pick<MapCompany, "latitude" | "longitude">) {
  return !hasUsableCoordinates(company);
}

export function matchesMapFilter(
  company: Pick<MapCompany, "id" | "lifecycleStatus">,
  filter: MapFilter,
  todayVisitIds: ReadonlySet<string> = new Set(),
) {
  switch (filter) {
    case "all":
      return true;
    case "to_prospect":
      return company.lifecycleStatus === "LEAD";
    case "in_progress":
      return (
        company.lifecycleStatus === "CONTACTED" ||
        company.lifecycleStatus === "QUALIFIED" ||
        company.lifecycleStatus === "OPPORTUNITY"
      );
    case "clients":
      return company.lifecycleStatus === "CLIENT";
    case "lost":
      return company.lifecycleStatus === "LOST";
    case "inactive":
      return company.lifecycleStatus === "INACTIVE";
    case "today_visits":
      return todayVisitIds.has(company.id);
    default:
      return true;
  }
}

export function matchesMapSearch(
  company: Pick<MapCompany, "name" | "city">,
  query: string,
  city: string,
) {
  const needle = query.trim().toLowerCase();
  const cityNeedle = city.trim().toLowerCase();

  if (needle && !company.name.toLowerCase().includes(needle)) {
    return false;
  }

  if (cityNeedle && !(company.city ?? "").toLowerCase().includes(cityNeedle)) {
    return false;
  }

  return true;
}

export function filterMapCompanies(
  companies: MapCompany[],
  options: {
    filter: MapFilter;
    query?: string;
    city?: string;
    todayVisitIds?: readonly string[];
  },
) {
  const todayVisitIds = new Set(options.todayVisitIds ?? []);
  return companies.filter(
    (company) =>
      matchesMapFilter(company, options.filter, todayVisitIds) &&
      matchesMapSearch(company, options.query ?? "", options.city ?? ""),
  );
}

export function plottableCompanies(companies: MapCompany[]) {
  return companies.filter(hasUsableCoordinates);
}

export function incompleteLocationCompanies(companies: MapCompany[]) {
  return companies.filter(needsLocation);
}

/** Simple grid clustering for tens/hundreds of markers without a second lifecycle. */
export function clusterPlottableCompanies(
  companies: MapCompany[],
  cellSize = 0.08,
) {
  const groups = new Map<string, MapCompany[]>();

  for (const company of plottableCompanies(companies)) {
    const lat = company.latitude as number;
    const lng = company.longitude as number;
    const key = `${Math.round(lat / cellSize)}:${Math.round(lng / cellSize)}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(company);
    groups.set(key, bucket);
  }

  return [...groups.values()];
}
