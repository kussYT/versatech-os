import "server-only";

import { z } from "zod";

export const UNTRUSTED_TEXT_MAX_CHARS = 400;

export const GEOCODE_STATUSES = ["OK", "FAILED", "MANUAL"] as const;

export const INTERACTION_DIRECTIONS = ["INBOUND", "OUTBOUND", "INTERNAL"] as const;

export const INTERACTION_RESULTS = [
  "NO_ANSWER",
  "GATEKEEPER",
  "CALLBACK",
  "INTERESTED",
  "NOT_INTERESTED",
  "MEETING_BOOKED",
  "OTHER",
] as const;

export const FOLLOW_UP_BUCKETS = ["overdue", "today", "upcoming", "completed"] as const;

export type GeocodeStatus = (typeof GEOCODE_STATUSES)[number];
export type InteractionDirection = (typeof INTERACTION_DIRECTIONS)[number];
export type InteractionResult = (typeof INTERACTION_RESULTS)[number];
export type FollowUpBucket = (typeof FOLLOW_UP_BUCKETS)[number];

const ISO_INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

/** Instant ISO 8601 (`Date.toISOString()`). Relative words like « demain » are invalid. */
export const isoDateTimeStringSchema = z.string().refine((value) => {
  if (!ISO_INSTANT_RE.test(value)) {
    return false;
  }
  return !Number.isNaN(Date.parse(value));
}, "Date ISO 8601 invalide (attendu Date.toISOString())");

export const truncatedTextSchema = z.strictObject({
  text: z.string().max(UNTRUSTED_TEXT_MAX_CHARS),
  truncated: z.boolean(),
});

export type TruncatedText = z.infer<typeof truncatedTextSchema>;

export function truncateUntrustedText(value: string): TruncatedText {
  if (value.length <= UNTRUSTED_TEXT_MAX_CHARS) {
    return { text: value, truncated: false };
  }

  return {
    text: value.slice(0, UNTRUSTED_TEXT_MAX_CHARS),
    truncated: true,
  };
}

export const namedEntitySchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
});
