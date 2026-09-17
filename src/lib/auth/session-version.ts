export const SESSION_VERSION_CLAIM = "sv";

export function readSessionVersionClaim(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return null;
  }

  return value;
}

export function isCurrentSessionVersion(tokenVersion: number, storedVersion: number) {
  return tokenVersion === storedVersion;
}
