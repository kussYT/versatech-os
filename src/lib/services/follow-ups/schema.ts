/**
 * Follow-up READ DTOs — board buckets, ISO dates, no UI href / phone dump.
 */
import { z } from "zod";

export const LIST_FOLLOW_UPS_LIMITS = {
  default: 15,
  max: 30,
} as const;

export const FOLLOW_UP_BUCKETS = ["overdue", "today", "upcoming", "completed"] as const;
export const PENDING_FOLLOW_UP_BUCKETS = ["overdue", "today", "upcoming"] as const;

export const FOLLOW_UP_STATUSES = ["PENDING", "COMPLETED", "CANCELED"] as const;

export const INTERACTION_TYPES = [
  "CALL",
  "EMAIL",
  "MEETING",
  "MESSAGE",
  "NOTE",
  "QUOTE",
  "PAYMENT",
  "OTHER",
] as const;

const ISO_INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

export const isoDateTimeStringSchema = z.string().refine((value) => {
  if (!ISO_INSTANT_RE.test(value)) {
    return false;
  }
  return !Number.isNaN(Date.parse(value));
}, "Date ISO 8601 invalide (attendu Date.toISOString())");

export const listFollowUpsInputSchema = z.strictObject({
  bucket: z.enum(FOLLOW_UP_BUCKETS).optional(),
  companyId: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(LIST_FOLLOW_UPS_LIMITS.max).default(LIST_FOLLOW_UPS_LIMITS.default),
});

export const followUpAgentSchema = z.strictObject({
  id: z.string().min(1),
  title: z.string().min(1),
  dueAt: isoDateTimeStringSchema,
  status: z.enum(FOLLOW_UP_STATUSES),
  completedAt: isoDateTimeStringSchema.nullable(),
  bucket: z.enum(FOLLOW_UP_BUCKETS),
  company: z.strictObject({
    id: z.string().min(1),
    name: z.string().min(1),
  }),
  lastInteraction: z
    .strictObject({
      type: z.enum(INTERACTION_TYPES),
      occurredAt: isoDateTimeStringSchema,
    })
    .nullable(),
});

export const followUpListSchema = z
  .strictObject({
    items: z.array(followUpAgentSchema).max(LIST_FOLLOW_UPS_LIMITS.max),
    returned: z.number().int().min(0),
    limit: z.number().int().min(1).max(LIST_FOLLOW_UPS_LIMITS.max),
  })
  .superRefine((value, ctx) => {
    if (value.returned !== value.items.length) {
      ctx.addIssue({
        code: "custom",
        message: "returned doit égaler items.length.",
        path: ["returned"],
      });
    }
    if (value.returned > value.limit) {
      ctx.addIssue({
        code: "custom",
        message: "returned ne peut pas dépasser limit.",
        path: ["returned"],
      });
    }
  });

export type FollowUpBucket = (typeof FOLLOW_UP_BUCKETS)[number];
export type PendingFollowUpBucket = (typeof PENDING_FOLLOW_UP_BUCKETS)[number];

/** Services throw this before any Prisma load. Never redirect. */
export function requireServiceActor(actor: { id?: string } | null | undefined) {
  if (!actor?.id) {
    throw new Error("Acteur requis.");
  }
}
export type FollowUpAgentDto = z.infer<typeof followUpAgentSchema>;
export type FollowUpListDto = z.infer<typeof followUpListSchema>;
export type ListFollowUpsParsed = z.output<typeof listFollowUpsInputSchema>;

export function emptyFollowUpList(limit = LIST_FOLLOW_UPS_LIMITS.default): FollowUpListDto {
  return parseFollowUpList({
    items: [],
    returned: 0,
    limit,
  });
}

export function clampCollection<T>(items: readonly T[], limit: number): T[] {
  return items.slice(0, limit);
}

export function parseListFollowUpsInput(input: unknown): ListFollowUpsParsed {
  return listFollowUpsInputSchema.parse(input);
}

export function parseFollowUpList(input: unknown): FollowUpListDto {
  return followUpListSchema.parse(input);
}

export function serializeFollowUpList(input: unknown): string {
  return JSON.stringify(parseFollowUpList(input));
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
