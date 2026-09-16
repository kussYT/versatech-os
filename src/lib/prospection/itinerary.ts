export type ItineraryDestination = {
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  name?: string | null;
};

export function formatCompanyAddress(parts: ItineraryDestination) {
  return [parts.address, parts.postalCode, parts.city, parts.country]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(", ");
}

export function hasUsableCoordinates(
  parts: Pick<ItineraryDestination, "latitude" | "longitude">,
) {
  return (
    typeof parts.latitude === "number" &&
    Number.isFinite(parts.latitude) &&
    typeof parts.longitude === "number" &&
    Number.isFinite(parts.longitude)
  );
}

/** External OSM destination. Never a GPS tracker. */
export function externalItineraryUrl(parts: ItineraryDestination) {
  if (hasUsableCoordinates(parts)) {
    return `https://www.openstreetmap.org/directions?to=${parts.latitude}%2C${parts.longitude}`;
  }

  const query = formatCompanyAddress(parts) || parts.name || "";
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;
}
