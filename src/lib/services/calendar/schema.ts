/**
 * Calendar READ DTOs — merged agenda items, Europe/Paris civil range.
 * Pas de Prisma, pas de `href` / `secondaryHref`, pas d'`editable`.
 * `kind === "terrain_visit"` n'est pas un RDV commercial.
 */
import { z } from "zod";
import { isValidCivilDate } from "@/lib/dates";

export const LIST_CALENDAR_LIMITS = {
  default: 30,
  max: 50,
  maxDays: 31,
} as const;

export const CALENDAR_ITEM_KINDS = [
  "event",
  "follow_up",
  "task",
  "project",
  "milestone",
  "terrain_visit",
] as const;

export const VISIT_STATUSES = ["pending", "visited"] as const;

export const CALENDAR_EVENT_TYPES = [
  "CALL",
  "FOLLOW_UP",
  "MEETING",
  "TASK",
  "DEADLINE",
  "DELIVERY",
  "MAINTENANCE",
  "ADMINISTRATIVE",
] as const;

const ISO_INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const CIVIL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const isoDateTimeStringSchema = z.string().refine((value) => {
  if (!ISO_INSTANT_RE.test(value)) {
    return false;
  }
  return !Number.isNaN(Date.parse(value));
}, "Date ISO 8601 invalide (attendu Date.toISOString())");

export const civilDateStringSchema = z.string().refine((value) => {
  const match = CIVIL_DATE_RE.exec(value);
  if (!match) {
    return false;
  }
  return isValidCivilDate(Number(match[1]), Number(match[2]), Number(match[3]));
}, "Jour civil invalide (YYYY-MM-DD Europe/Paris)");

const nonNegativeIntSchema = z.number().int().min(0);

const entityLinkSchema = z
  .strictObject({
    id: z.string().min(1),
    name: z.string().min(1),
  })
  .nullable();

export const listCalendarItemsInputSchema = z
  .strictObject({
    from: civilDateStringSchema,
    to: civilDateStringSchema,
    limit: z
      .number()
      .int()
      .min(1)
      .max(LIST_CALENDAR_LIMITS.max)
      .default(LIST_CALENDAR_LIMITS.default),
  })
  .superRefine((value, ctx) => {
    if (value.from > value.to) {
      ctx.addIssue({
        code: "custom",
        message: "from doit être ≤ to.",
        path: ["from"],
      });
    }
  });

/**
 * Inclusive civil-day span (YYYY-MM-DD as calendar dates, not host TZ).
 * `from > to` yields a value ≤ 0.
 */
export function inclusiveCivilDayCount(from: string, to: string): number {
  const fromMatch = CIVIL_DATE_RE.exec(from);
  const toMatch = CIVIL_DATE_RE.exec(to);
  if (!fromMatch || !toMatch) {
    return Number.NaN;
  }

  const fromUtc = Date.UTC(
    Number(fromMatch[1]),
    Number(fromMatch[2]) - 1,
    Number(fromMatch[3]),
  );
  const toUtc = Date.UTC(Number(toMatch[1]), Number(toMatch[2]) - 1, Number(toMatch[3]));
  return Math.floor((toUtc - fromUtc) / 86_400_000) + 1;
}

export function isCalendarRangeTooLarge(from: string, to: string): boolean {
  return inclusiveCivilDayCount(from, to) > LIST_CALENDAR_LIMITS.maxDays;
}

export const RANGE_TOO_LARGE_MESSAGE = "La plage demandée est trop large.";

export const calendarItemAgentSchema = z
  .strictObject({
    id: z.string().min(1),
    kind: z.enum(CALENDAR_ITEM_KINDS),
    entityId: z.string().min(1),
    title: z.string().min(1),
    startsAt: isoDateTimeStringSchema,
    endsAt: isoDateTimeStringSchema,
    allDay: z.boolean(),
    eventType: z.enum(CALENDAR_EVENT_TYPES).nullable(),
    company: entityLinkSchema,
    project: entityLinkSchema,
    overdue: z.boolean(),
    visitOrder: nonNegativeIntSchema.nullable(),
    visitStatus: z.enum(VISIT_STATUSES).nullable(),
  })
  .superRefine((item, ctx) => {
    const isTerrain = item.kind === "terrain_visit";
    const isEvent = item.kind === "event";

    if (isTerrain) {
      if (!item.allDay) {
        ctx.addIssue({
          code: "custom",
          message: "Une visite terrain est une journée entière Paris (allDay), sans heure fictive.",
          path: ["allDay"],
        });
      }
      if (item.eventType !== null) {
        ctx.addIssue({
          code: "custom",
          message: "terrain_visit n'est pas un CalendarEvent : eventType doit être null.",
          path: ["eventType"],
        });
      }
      if (item.visitStatus === null) {
        ctx.addIssue({
          code: "custom",
          message: "terrain_visit exige visitStatus pending|visited.",
          path: ["visitStatus"],
        });
      }
      if (item.visitOrder === null) {
        ctx.addIssue({
          code: "custom",
          message: "terrain_visit exige visitOrder (TourStop.order).",
          path: ["visitOrder"],
        });
      }
      if (item.company === null) {
        ctx.addIssue({
          code: "custom",
          message: "terrain_visit exige company id+name.",
          path: ["company"],
        });
      }
      return;
    }

    if (item.visitStatus !== null) {
      ctx.addIssue({
        code: "custom",
        message: "visitStatus est réservé à kind=terrain_visit.",
        path: ["visitStatus"],
      });
    }
    if (item.visitOrder !== null) {
      ctx.addIssue({
        code: "custom",
        message: "visitOrder est réservé à kind=terrain_visit.",
        path: ["visitOrder"],
      });
    }

    if (isEvent && item.eventType === null) {
      ctx.addIssue({
        code: "custom",
        message: "kind=event exige un eventType CalendarEvent.",
        path: ["eventType"],
      });
    }
    if (!isEvent && item.eventType !== null) {
      ctx.addIssue({
        code: "custom",
        message: "eventType n'est renseigné que pour kind=event.",
        path: ["eventType"],
      });
    }
  });

export const calendarListSchema = z
  .strictObject({
    from: civilDateStringSchema,
    to: civilDateStringSchema,
    items: z.array(calendarItemAgentSchema).max(LIST_CALENDAR_LIMITS.max),
    returned: z.number().int().min(0),
    truncated: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.returned !== value.items.length) {
      ctx.addIssue({
        code: "custom",
        message: "returned doit égaler items.length.",
        path: ["returned"],
      });
    }
    if (value.from > value.to) {
      ctx.addIssue({
        code: "custom",
        message: "from doit être ≤ to.",
        path: ["from"],
      });
    }
  });

export type CalendarItemKind = (typeof CALENDAR_ITEM_KINDS)[number];
export type VisitStatus = (typeof VISIT_STATUSES)[number];
export type CalendarEventType = (typeof CALENDAR_EVENT_TYPES)[number];
export type CalendarItemAgentDto = z.infer<typeof calendarItemAgentSchema>;
export type CalendarListDto = z.infer<typeof calendarListSchema>;
export type ListCalendarItemsParsed = z.output<typeof listCalendarItemsInputSchema>;

/** Services throw this before any Prisma load. Never redirect. */
export function requireServiceActor(actor: { id?: string } | null | undefined) {
  if (!actor?.id) {
    throw new Error("Acteur requis.");
  }
}

export function emptyCalendarList(from: string, to: string): CalendarListDto {
  return parseCalendarList({
    from,
    to,
    items: [],
    returned: 0,
    truncated: false,
  });
}

export function clampCollection<T>(items: readonly T[], limit: number): T[] {
  return items.slice(0, limit);
}

export function parseListCalendarItemsInput(input: unknown): ListCalendarItemsParsed {
  return listCalendarItemsInputSchema.parse(input);
}

export function parseCalendarList(input: unknown): CalendarListDto {
  return calendarListSchema.parse(input);
}

export function serializeCalendarList(input: unknown): string {
  return JSON.stringify(parseCalendarList(input));
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
