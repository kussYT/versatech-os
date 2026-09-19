import "server-only";

import type { FinanceTotals } from "@/lib/finance";
import { normalizeMoney } from "@/lib/money";
import {
  parseCommercialBrief,
  type CommercialBrief,
} from "@/lib/prospection/brief";
import { selectPrincipalProject } from "@/lib/projects/principal";
import type { MatchingCompanyRow } from "@/lib/queries/search";
import { buildWebsiteStatus } from "@/lib/website/status";
import {
  clampCollection,
  COMPANY_COMPACT_LIMITS,
  SEARCH_COMPANIES_LIMITS,
  parseCompanyCompact,
  parseCompanySearch,
  truncateUntrustedText,
  type CompanyCompact,
  type CompanySearchDto,
  type CompanySearchHit,
  type InteractionType,
} from "./schema";

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export type CompanyCompactLoaded = {
  id: string;
  name: string;
  lifecycleStatus: CompanyCompact["lifecycleStatus"];
  industry: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  source: string | null;
  priority: CompanyCompact["priority"];
  description: string | null;
  commercialBrief: unknown;
  geocodeStatus: CompanyCompact["geocodeStatus"];
  contacts: CompanyCompact["contacts"];
  lastInteraction: {
    id: string;
    type: InteractionType;
    direction: NonNullable<CompanyCompact["lastInteraction"]>["direction"];
    result: NonNullable<CompanyCompact["lastInteraction"]>["result"];
    notes: string | null;
    subject: string | null;
    occurredAt: Date | string;
  } | null;
  nextFollowUp: {
    id: string;
    title: string;
    dueAt: Date | string;
    status: NonNullable<CompanyCompact["nextFollowUp"]>["status"];
  } | null;
  openOpportunities: Array<{
    id: string;
    title: string;
    stage: CompanyCompact["openOpportunities"][number]["stage"];
    estimatedValue: string;
    updatedAt: Date | string;
  }>;
  projects: Array<{
    id: string;
    name: string;
    status: NonNullable<CompanyCompact["principalProject"]>["status"];
    startDate: Date | string | null;
    completedAt: Date | string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
  }>;
  maintenanceContracts: Array<{
    id: string;
    status: "ACTIVE" | "PAUSED" | "ENDED" | "CANCELED";
    monthlyAmount: string;
    startDate: Date | string;
    projectId: string | null;
  }>;
};

function toPrimaryContact(
  contacts: Array<{ firstName: string; lastName: string; role: string | null; isPrimary?: boolean }>,
): CompanySearchHit["primaryContact"] {
  const primary = contacts.find((contact) => contact.isPrimary) ?? contacts[0] ?? null;
  return primary
    ? {
        firstName: primary.firstName,
        lastName: primary.lastName,
        role: primary.role,
      }
    : null;
}

export function mapCompanySearchHit(row: MatchingCompanyRow): CompanySearchHit {
  return {
    id: row.id,
    name: row.name,
    lifecycleStatus: row.lifecycleStatus,
    city: row.city,
    industry: row.industry,
    primaryContact: toPrimaryContact(row.contacts),
  };
}

export function mapCompanySearch(
  rows: MatchingCompanyRow[],
  query: string,
  limit: number = SEARCH_COMPANIES_LIMITS.max,
): CompanySearchDto {
  const items = clampCollection(rows.map(mapCompanySearchHit), limit);
  return parseCompanySearch({
    query,
    total: items.length,
    items,
  });
}

function toCommercialBrief(value: unknown): CompanyCompact["commercialBrief"] {
  const parsed: CommercialBrief = parseCommercialBrief(value);
  const digitalPresence = truncateUntrustedText(parsed.digitalPresence);
  const strengths = truncateUntrustedText(parsed.strengths);
  const opportunities = truncateUntrustedText(parsed.opportunities);
  const proposal = truncateUntrustedText(parsed.proposal);
  const angle = truncateUntrustedText(parsed.angle);
  const hasText = Boolean(digitalPresence || strengths || opportunities || proposal || angle);

  if (!hasText && parsed.verificationStatus === "UNVERIFIED") {
    return null;
  }

  return {
    verificationStatus: parsed.verificationStatus,
    digitalPresence,
    strengths,
    opportunities,
    proposal,
    angle,
  };
}

function toWebsitePresence(loaded: CompanyCompactLoaded, now: Date): CompanyCompact["websitePresence"] {
  const view = buildWebsiteStatus({
    website: loaded.website,
    projects: loaded.projects,
    contracts: loaded.maintenanceContracts.map((contract) => ({
      id: contract.id,
      status: contract.status,
      monthlyAmount: contract.monthlyAmount,
      startDate: contract.startDate,
      projectId: contract.projectId,
    })),
    now,
  });

  return {
    status: view.status,
    url: view.url?.href ?? null,
    host: view.url?.host ?? null,
  };
}

function toPrincipalProject(loaded: CompanyCompactLoaded, now: Date): CompanyCompact["principalProject"] {
  const selected = selectPrincipalProject(loaded.projects, loaded.maintenanceContracts, { now });
  if (!selected) {
    return null;
  }

  return {
    id: selected.project.id,
    name: selected.project.name,
    status: selected.project.status,
    source: selected.source,
  };
}

function toFinanceSummary(finance: FinanceTotals): CompanyCompact["finance"] {
  return {
    signed: finance.signed,
    collected: finance.collected,
    remaining: finance.remaining,
    overdueCount: finance.overdueCount,
  };
}

/**
 * Query load → agent compact DTO.
 * LIVE website status only via `buildWebsiteStatus` (COMPLETED, never invented).
 * Brief only via `parseCommercialBrief` (truncated, never raw JSON).
 */
export function mapCompanyCompact(
  loaded: CompanyCompactLoaded,
  finance: FinanceTotals,
  now = new Date(),
): CompanyCompact {
  const contacts = clampCollection(loaded.contacts, COMPANY_COMPACT_LIMITS.contacts);
  const openOpportunities = clampCollection(loaded.openOpportunities, COMPANY_COMPACT_LIMITS.openOpportunities).map(
    (opportunity) => ({
      id: opportunity.id,
      title: opportunity.title,
      stage: opportunity.stage,
      estimatedValue: normalizeMoney(opportunity.estimatedValue),
      updatedAt: toIso(opportunity.updatedAt),
    }),
  );
  const last = loaded.lastInteraction;

  return parseCompanyCompact({
    id: loaded.id,
    name: loaded.name,
    lifecycleStatus: loaded.lifecycleStatus,
    industry: loaded.industry,
    website: loaded.website,
    phone: loaded.phone,
    email: loaded.email,
    address: loaded.address,
    city: loaded.city,
    postalCode: loaded.postalCode,
    country: loaded.country,
    source: loaded.source,
    priority: loaded.priority,
    geocodeStatus: loaded.geocodeStatus,
    description: truncateUntrustedText(loaded.description),
    isClient: loaded.lifecycleStatus === "CLIENT",
    primaryContact: toPrimaryContact(contacts),
    contacts,
    lastInteraction: last
      ? {
          id: last.id,
          type: last.type,
          direction: last.direction,
          result: last.result,
          subject: truncateUntrustedText(last.subject),
          notes: truncateUntrustedText(last.notes),
          occurredAt: toIso(last.occurredAt),
        }
      : null,
    nextFollowUp: loaded.nextFollowUp
      ? {
          id: loaded.nextFollowUp.id,
          title: loaded.nextFollowUp.title,
          dueAt: toIso(loaded.nextFollowUp.dueAt),
          status: loaded.nextFollowUp.status,
        }
      : null,
    hasOpenOpportunity: openOpportunities.length > 0,
    openOpportunities,
    principalProject: toPrincipalProject(loaded, now),
    websitePresence: toWebsitePresence(loaded, now),
    finance: toFinanceSummary(finance),
    commercialBrief: toCommercialBrief(loaded.commercialBrief),
  });
}
