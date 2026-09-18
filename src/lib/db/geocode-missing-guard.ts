export const GEOCODE_MISSING_FLAG = "ALLOW_GEOCODE_MISSING_COMPANIES";

export type GeocodeMissingEnv = NodeJS.Dict<string | undefined>;

function flagIsTrue(env: GeocodeMissingEnv) {
  return env[GEOCODE_MISSING_FLAG]?.trim().toLowerCase() === "true";
}

export function isGeocodeMissingAllowed(env: GeocodeMissingEnv = process.env): boolean {
  if (env.NODE_ENV === "production") {
    return flagIsTrue(env);
  }

  return true;
}

export function assertGeocodeMissingAllowed(env: GeocodeMissingEnv = process.env): void {
  if (isGeocodeMissingAllowed(env)) {
    return;
  }

  throw new Error(
    `Refusing missing-company geocode in production. Set ${GEOCODE_MISSING_FLAG}=true only for this additive, idempotent Nominatim pass. Never invent coordinates. ALEX'CEPTION is skipped.`,
  );
}
