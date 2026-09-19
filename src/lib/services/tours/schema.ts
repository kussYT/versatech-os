/**
 * Today-tour READ DTO — terrain truth Tour / TourStop, Europe/Paris civil day.
 * Pas de latitude/longitude, pas de notes, pas de `href`.
 */
import { z } from "zod";
import { isValidCivilDate } from "@/lib/dates";

export const TODAY_TOUR_STOP_LIMIT = 50;

export const COMPANY_LIFECYCLES = [
  "LEAD",
  "CONTACTED",
  "QUALIFIED",
  "OPPORTUNITY",
  "CLIENT",
  "INACTIVE",
  "LOST",
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

export const getTodayTourInputSchema = z.strictObject({});

export const todayTourStopCompanySchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  lifecycleStatus: z.enum(COMPANY_LIFECYCLES),
  address: z.string().nullable(),
  city: z.string().nullable(),
  postalCode: z.string().nullable(),
  country: z.string().nullable(),
  phone: z.string().nullable(),
});

export const todayTourStopSchema = z.strictObject({
  id: z.string().min(1),
  order: z.number().int().min(0),
  visitedAt: isoDateTimeStringSchema.nullable(),
  company: todayTourStopCompanySchema,
});

export const todayTourSchema = z
  .strictObject({
    id: z.string().min(1),
    date: isoDateTimeStringSchema,
    planned: z.number().int().min(0),
    visited: z.number().int().min(0),
    remaining: z.number().int().min(0),
    truncated: z.boolean(),
    stops: z.array(todayTourStopSchema).max(TODAY_TOUR_STOP_LIMIT),
  })
  .superRefine((tour, ctx) => {
    if (tour.visited + tour.remaining !== tour.planned) {
      ctx.addIssue({
        code: "custom",
        message: "visited + remaining doit égaler planned.",
        path: ["remaining"],
      });
    }
    if (tour.truncated) {
      if (tour.planned <= TODAY_TOUR_STOP_LIMIT) {
        ctx.addIssue({
          code: "custom",
          message: "truncated exige planned > 50.",
          path: ["truncated"],
        });
      }
      if (tour.stops.length !== TODAY_TOUR_STOP_LIMIT) {
        ctx.addIssue({
          code: "custom",
          message: "truncated exige exactement 50 stops renvoyés.",
          path: ["stops"],
        });
      }
      return;
    }
    if (tour.stops.length !== tour.planned) {
      ctx.addIssue({
        code: "custom",
        message: "Sans truncation, stops.length doit égaler planned.",
        path: ["stops"],
      });
    }
  });

export type CompanyLifecycle = (typeof COMPANY_LIFECYCLES)[number];
export type TodayTourStopDto = z.infer<typeof todayTourStopSchema>;
export type TodayTourDto = z.infer<typeof todayTourSchema>;

/** Services throw this before any Prisma load. Never redirect. */
export function requireServiceActor(actor: { id?: string } | null | undefined) {
  if (!actor?.id) {
    throw new Error("Acteur requis.");
  }
}

export function parseTodayTour(input: unknown): TodayTourDto | null {
  if (input === null) {
    return null;
  }
  return todayTourSchema.parse(input);
}

export function serializeTodayTour(input: unknown): string {
  return JSON.stringify(parseTodayTour(input));
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
