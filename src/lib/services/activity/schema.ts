/**
 * Recent activity READ DTO — ACTIVITY_LABELS, jamais metadata.
 */
import { z } from "zod";

export const RECENT_ACTIVITY_LIMITS = {
  default: 8,
  max: 20,
} as const;

const ISO_INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

export const isoDateTimeStringSchema = z.string().refine((value) => {
  if (!ISO_INSTANT_RE.test(value)) {
    return false;
  }
  return !Number.isNaN(Date.parse(value));
}, "Date ISO 8601 invalide (attendu Date.toISOString())");

export const getRecentActivityInputSchema = z.strictObject({
  limit: z
    .number()
    .int()
    .min(1)
    .max(RECENT_ACTIVITY_LIMITS.max)
    .default(RECENT_ACTIVITY_LIMITS.default),
});

export const recentActivityAgentSchema = z.strictObject({
  id: z.string().min(1),
  action: z.string().min(1),
  /** `ACTIVITY_LABELS[action] ?? action` — pas de `metadata`. */
  label: z.string().min(1),
  entityType: z.string().min(1),
  createdAt: isoDateTimeStringSchema,
  actorName: z.string().nullable(),
});

export const recentActivityListSchema = z.strictObject({
  items: z.array(recentActivityAgentSchema).max(RECENT_ACTIVITY_LIMITS.max),
});

export type RecentActivityAgentDto = z.infer<typeof recentActivityAgentSchema>;
export type RecentActivityDto = z.infer<typeof recentActivityListSchema>;
export type GetRecentActivityParsed = z.output<typeof getRecentActivityInputSchema>;

/** Services throw this before any Prisma load. Never redirect. */
export function requireServiceActor(actor: { id?: string } | null | undefined) {
  if (!actor?.id) {
    throw new Error("Acteur requis.");
  }
}

export function emptyRecentActivity(): RecentActivityDto {
  return parseRecentActivity({ items: [] });
}

export function clampCollection<T>(items: readonly T[], limit: number): T[] {
  return items.slice(0, limit);
}

export function parseGetRecentActivityInput(input: unknown): GetRecentActivityParsed {
  return getRecentActivityInputSchema.parse(input);
}

export function parseRecentActivity(input: unknown): RecentActivityDto {
  return recentActivityListSchema.parse(input);
}

export function serializeRecentActivity(input: unknown): string {
  return JSON.stringify(parseRecentActivity(input));
}

export function isPlainJsonValue(value: unknown): boolean {
  if (value === null) {
    return true;
  }

  const valueType = typeof value;
  if (valueType === "string" || valueType === "boolean") {
    return true;
  }
  if (valueType === "number") {
    return Number.isFinite(value);
  }
  if (valueType !== "object") {
    return false;
  }

  if (Array.isArray(value)) {
    return value.every(isPlainJsonValue);
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return false;
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    return false;
  }

  return Object.values(value as Record<string, unknown>).every(isPlainJsonValue);
}
