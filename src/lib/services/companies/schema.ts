/**
 * Company READ DTOs — search hits + compact fiche (not the hub).
 * Pas de Prisma, pas de `href` UI, pas de secrets, pas de dump JSON brief.
 */
import { z } from "zod";
import { BRIEF_VERIFICATION_STATUSES } from "@/lib/prospection/brief";
import { tryParseMoneyToCents } from "@/lib/money";
import { WEBSITE_STATUSES } from "@/lib/website/status";

export const SEARCH_COMPANIES_LIMITS = {
  default: 10,
  max: 20,
} as const;

export const COMPANY_COMPACT_LIMITS = {
  contacts: 8,
  openOpportunities: 8,
  untrustedText: 400,
} as const;

export const COMPANY_LIFECYCLES = [
  "LEAD",
  "CONTACTED",
  "QUALIFIED",
  "OPPORTUNITY",
  "CLIENT",
  "INACTIVE",
  "LOST",
] as const;

export const PRIORITIES = ["LOW", "NORMAL", "MEDIUM", "HIGH", "URGENT"] as const;

export const GEOCODE_STATUSES = ["OK", "FAILED", "MANUAL"] as const;

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

export const FOLLOW_UP_STATUSES = ["PENDING", "COMPLETED", "CANCELED"] as const;

export const OPPORTUNITY_STAGES = [
  "TO_QUALIFY",
  "TO_CONTACT",
  "CONTACTED",
  "INTERESTED",
  "MEETING",
  "QUOTE",
  "WON",
  "LOST",
] as const;

export const PROJECT_STATUSES = [
  "PLANNED",
  "ACTIVE",
  "WAITING_CLIENT",
  "REVIEW",
  "COMPLETED",
  "ARCHIVED",
] as const;

export const PRINCIPAL_PROJECT_SOURCES = [
  "explicit",
  "in_development",
  "completed_maintenance",
  "completed",
  "planned",
  "archived",
] as const;

const CANONICAL_MONEY_RE = /^-?\d+\.\d{2}$/;
const ISO_INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

export const moneyStringSchema = z.string().refine((value) => {
  if (!CANONICAL_MONEY_RE.test(value)) {
    return false;
  }
  return tryParseMoneyToCents(value) !== null;
}, 'Montant invalide (string money canonique, ex. "1234.56")');

export const isoDateTimeStringSchema = z.string().refine((value) => {
  if (!ISO_INSTANT_RE.test(value)) {
    return false;
  }
  return !Number.isNaN(Date.parse(value));
}, "Date ISO 8601 invalide (attendu Date.toISOString())");

export const truncatedTextSchema = z.strictObject({
  text: z.string().min(1).max(COMPANY_COMPACT_LIMITS.untrustedText),
  truncated: z.boolean(),
});

const primaryContactSchema = z
  .strictObject({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    role: z.string().nullable(),
  })
  .nullable();

export const searchCompaniesInputSchema = z.strictObject({
  query: z.string().trim().min(2).max(80),
  lifecycle: z.enum(COMPANY_LIFECYCLES).optional(),
  city: z.string().trim().min(1).max(80).optional(),
  limit: z.number().int().min(1).max(SEARCH_COMPANIES_LIMITS.max).default(SEARCH_COMPANIES_LIMITS.default),
});

export const getCompanyInputSchema = z.strictObject({
  companyId: z.string().min(1),
});

export const companySearchHitSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  lifecycleStatus: z.enum(COMPANY_LIFECYCLES),
  city: z.string().nullable(),
  industry: z.string().nullable(),
  primaryContact: primaryContactSchema,
});

export const companySearchSchema = z
  .strictObject({
    query: z.string().min(2).max(80),
    total: z.number().int().min(0),
    items: z.array(companySearchHitSchema).max(SEARCH_COMPANIES_LIMITS.max),
  })
  .superRefine((value, ctx) => {
    if (value.total !== value.items.length) {
      ctx.addIssue({
        code: "custom",
        message: "total doit égaler items.length (hits retournés, pas un count SQL global).",
        path: ["total"],
      });
    }
  });

export const companyContactSchema = z.strictObject({
  id: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  isPrimary: z.boolean(),
});

export const lastInteractionSchema = z
  .strictObject({
    id: z.string().min(1),
    type: z.enum(INTERACTION_TYPES),
    direction: z.enum(INTERACTION_DIRECTIONS),
    result: z.enum(INTERACTION_RESULTS).nullable(),
    subject: truncatedTextSchema.nullable(),
    notes: truncatedTextSchema.nullable(),
    occurredAt: isoDateTimeStringSchema,
  })
  .nullable();

export const nextFollowUpSchema = z
  .strictObject({
    id: z.string().min(1),
    title: z.string().min(1),
    dueAt: isoDateTimeStringSchema,
    status: z.enum(FOLLOW_UP_STATUSES),
  })
  .nullable();

export const openOpportunitySchema = z.strictObject({
  id: z.string().min(1),
  title: z.string().min(1),
  stage: z.enum(OPPORTUNITY_STAGES),
  estimatedValue: moneyStringSchema,
  updatedAt: isoDateTimeStringSchema,
});

export const principalProjectSchema = z
  .strictObject({
    id: z.string().min(1),
    name: z.string().min(1),
    status: z.enum(PROJECT_STATUSES),
    source: z.enum(PRINCIPAL_PROJECT_SOURCES),
  })
  .nullable();

export const websitePresenceSchema = z.strictObject({
  status: z.enum(WEBSITE_STATUSES).nullable(),
  url: z.string().nullable(),
  host: z.string().nullable(),
});

export const commercialBriefSchema = z
  .strictObject({
    verificationStatus: z.enum(BRIEF_VERIFICATION_STATUSES),
    digitalPresence: truncatedTextSchema.nullable(),
    strengths: truncatedTextSchema.nullable(),
    opportunities: truncatedTextSchema.nullable(),
    proposal: truncatedTextSchema.nullable(),
    angle: truncatedTextSchema.nullable(),
  })
  .nullable();

export const companyFinanceSummarySchema = z.strictObject({
  signed: moneyStringSchema,
  collected: moneyStringSchema,
  remaining: moneyStringSchema,
  overdueCount: z.number().int().min(0),
});

/**
 * Fiche compacte : identité + signaux utiles.
 * Interdit : historique interactions, liste devis, paiements, documents,
 * maintenance, journey, allowedLifecycleStatuses, JSON brief brut, href UI.
 */
export const companyCompactSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  lifecycleStatus: z.enum(COMPANY_LIFECYCLES),
  industry: z.string().nullable(),
  website: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  postalCode: z.string().nullable(),
  country: z.string().nullable(),
  source: z.string().nullable(),
  priority: z.enum(PRIORITIES),
  geocodeStatus: z.enum(GEOCODE_STATUSES).nullable(),
  description: truncatedTextSchema.nullable(),
  isClient: z.boolean(),
  primaryContact: primaryContactSchema,
  contacts: z.array(companyContactSchema).max(COMPANY_COMPACT_LIMITS.contacts),
  lastInteraction: lastInteractionSchema,
  nextFollowUp: nextFollowUpSchema,
  hasOpenOpportunity: z.boolean(),
  openOpportunities: z.array(openOpportunitySchema).max(COMPANY_COMPACT_LIMITS.openOpportunities),
  principalProject: principalProjectSchema,
  websitePresence: websitePresenceSchema,
  finance: companyFinanceSummarySchema,
  commercialBrief: commercialBriefSchema,
});

export type SearchCompaniesFields = z.input<typeof searchCompaniesInputSchema>;
export type SearchCompaniesParsed = z.output<typeof searchCompaniesInputSchema>;
export type GetCompanyFields = z.infer<typeof getCompanyInputSchema>;
export type CompanySearchHit = z.infer<typeof companySearchHitSchema>;
export type CompanySearchDto = z.infer<typeof companySearchSchema>;
export type CompanyCompact = z.infer<typeof companyCompactSchema>;
export type TruncatedText = z.infer<typeof truncatedTextSchema>;
export type CompanyLifecycle = (typeof COMPANY_LIFECYCLES)[number];

/** Services throw this before any Prisma load. Never redirect. */
export function requireServiceActor(actor: { id?: string } | null | undefined) {
  if (!actor?.id) {
    throw new Error("Acteur requis.");
  }
}
export type Priority = (typeof PRIORITIES)[number];
export type GeocodeStatus = (typeof GEOCODE_STATUSES)[number];
export type InteractionType = (typeof INTERACTION_TYPES)[number];
export type InteractionDirection = (typeof INTERACTION_DIRECTIONS)[number];
export type InteractionResult = (typeof INTERACTION_RESULTS)[number];
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];
export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type PrincipalProjectSource = (typeof PRINCIPAL_PROJECT_SOURCES)[number];

export function truncateUntrustedText(value: string | null | undefined): TruncatedText | null {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length <= COMPANY_COMPACT_LIMITS.untrustedText) {
    return { text: trimmed, truncated: false };
  }

  return {
    text: trimmed.slice(0, COMPANY_COMPACT_LIMITS.untrustedText),
    truncated: true,
  };
}

export function emptyCompanySearch(query = "ab"): CompanySearchDto {
  return parseCompanySearch({
    query,
    total: 0,
    items: [],
  });
}

export function clampCollection<T>(items: readonly T[], limit: number): T[] {
  return items.slice(0, limit);
}

export function parseSearchCompaniesInput(input: unknown): SearchCompaniesParsed {
  return searchCompaniesInputSchema.parse(input);
}

export function parseCompanySearch(input: unknown): CompanySearchDto {
  return companySearchSchema.parse(input);
}

export function parseCompanyCompact(input: unknown): CompanyCompact {
  return companyCompactSchema.parse(input);
}

export function assertCompanyCompact(input: unknown): asserts input is CompanyCompact {
  parseCompanyCompact(input);
}

export function serializeCompanyCompact(input: unknown): string {
  return JSON.stringify(parseCompanyCompact(input));
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
