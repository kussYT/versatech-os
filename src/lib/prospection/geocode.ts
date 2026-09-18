import { formatCompanyAddress, hasUsableCoordinates } from "./itinerary";
import type { MapCompany } from "./map-model";

export const NOMINATIM_TIMEOUT_MS = 8_000;
export const PROTECTED_GEOCODE_COMPANY_ID = "cmu5gwo610000vwum30m6q88p";

export type GeocodeStatusValue = "OK" | "FAILED" | "MANUAL";

export type GeocodeCompanySnapshot = Pick<
  MapCompany,
  "id" | "name" | "address" | "postalCode" | "city" | "country" | "latitude" | "longitude"
> & {
  geocodedAddress?: string | null;
  geocodeStatus?: GeocodeStatusValue | null;
};

export type GeocodePlan =
  | { action: "skip"; reason: "protected" | "has_coords" | "already_failed" | "manual" }
  | { action: "mark_manual"; reason: "insufficient_address"; query: string }
  | { action: "fetch"; query: string };

export function isNominatimConfigured(userAgent = process.env.NOMINATIM_USER_AGENT) {
  return Boolean(userAgent?.trim());
}

export function nominatimRequestInit(userAgent: string): RequestInit {
  return {
    headers: {
      "User-Agent": userAgent,
      Accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(NOMINATIM_TIMEOUT_MS),
  };
}

export function nominatimSearchUrl(query: string) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "0");
  return url.toString();
}

export type NominatimHit = {
  lat: number;
  lon: number;
  displayName: string;
};

export function parseNominatimHit(payload: unknown): NominatimHit | null {
  if (!Array.isArray(payload) || payload.length === 0) {
    return null;
  }

  const first = payload[0];
  if (!first || typeof first !== "object") {
    return null;
  }

  const lat = Number((first as { lat?: string }).lat);
  const lon = Number((first as { lon?: string }).lon);
  const displayName = String((first as { display_name?: string }).display_name ?? "");

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  return { lat, lon, displayName };
}

export function geocodeQueryForCompany(
  company: Pick<MapCompany, "address" | "postalCode" | "city" | "country" | "name">,
) {
  return formatCompanyAddress(company) || company.name;
}

/** Street-level address with a number. City-only is not enough to place a marker. */
export function hasGeocodableStreetAddress(company: Pick<MapCompany, "address">) {
  const address = company.address?.trim() ?? "";
  return /\d/.test(address);
}

export function shouldSkipGeocode(
  company: Pick<MapCompany, "latitude" | "longitude"> & { geocodedAddress?: string | null },
  currentAddress: string,
) {
  if (!currentAddress.trim()) {
    return true;
  }

  return hasUsableCoordinates(company) && (company.geocodedAddress ?? "") === currentAddress;
}

export function planCompanyGeocode(company: GeocodeCompanySnapshot): GeocodePlan {
  if (company.id === PROTECTED_GEOCODE_COMPANY_ID) {
    return { action: "skip", reason: "protected" };
  }

  if (hasUsableCoordinates(company)) {
    return { action: "skip", reason: "has_coords" };
  }

  if (company.geocodeStatus === "MANUAL") {
    return { action: "skip", reason: "manual" };
  }

  if (!hasGeocodableStreetAddress(company)) {
    return {
      action: "mark_manual",
      reason: "insufficient_address",
      query: geocodeQueryForCompany(company),
    };
  }

  const query = geocodeQueryForCompany(company);
  if (
    company.geocodeStatus === "FAILED" &&
    (company.geocodedAddress ?? "") === query
  ) {
    return { action: "skip", reason: "already_failed" };
  }

  return { action: "fetch", query };
}

export async function fetchNominatimHit(query: string, userAgent: string) {
  const response = await fetch(nominatimSearchUrl(query), nominatimRequestInit(userAgent));
  if (!response.ok) {
    return null;
  }

  return parseNominatimHit(await response.json());
}
