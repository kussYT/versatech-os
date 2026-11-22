/**
 * Pure rules for CRM → Google push (auto + manual retry).
 * No Prisma, no tokens — unit-testable.
 */

export type PushEligibilityInput = {
  type: string;
  syncStatus: string | null;
  externalProvider: string | null;
  externalId: string | null;
};

export type PushEligibility =
  | { eligible: false; reason: "not_meeting" | "imported" | "remote_deleted" }
  | { eligible: true; mode: "create" | "update" };

/**
 * A CRM RDV (CalendarEvent type MEETING) may be pushed when it is not a
 * Google-imported event. Terrain / follow-ups / tasks never go through here.
 */
export function evaluateGooglePushEligibility(
  event: PushEligibilityInput,
): PushEligibility {
  if (event.type !== "MEETING") {
    return { eligible: false, reason: "not_meeting" };
  }

  if (event.syncStatus === "imported") {
    return { eligible: false, reason: "imported" };
  }

  if (event.syncStatus === "remote_deleted") {
    return { eligible: false, reason: "remote_deleted" };
  }

  if (
    event.externalProvider === "google" &&
    event.externalId &&
    (event.syncStatus === "pushed" ||
      event.syncStatus === "pending" ||
      (event.syncStatus?.startsWith("error:") ?? false) ||
      event.syncStatus === null)
  ) {
    return { eligible: true, mode: "update" };
  }

  if (event.externalProvider === "google" && event.externalId) {
    // Linked to Google but unexpected status — still update to avoid duplicates.
    return { eligible: true, mode: "update" };
  }

  return { eligible: true, mode: "create" };
}
