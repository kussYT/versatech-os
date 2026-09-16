import { formatCompanyAddress } from "./itinerary";
import type { MapCompany } from "./map-model";

export function isNominatimConfigured(userAgent = process.env.NOMINATIM_USER_AGENT) {
  return Boolean(userAgent?.trim());
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

export function shouldSkipGeocode(
  company: Pick<MapCompany, "latitude" | "longitude"> & { geocodedAddress?: string | null },
  currentAddress: string,
) {
  if (!currentAddress.trim()) {
    return true;
  }

  return (
    typeof company.latitude === "number" &&
    typeof company.longitude === "number" &&
    (company.geocodedAddress ?? "") === currentAddress
  );
}
