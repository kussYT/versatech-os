import "server-only";

import { requireAuthenticatedUser } from "@/lib/auth/dal";

import type { CompanyLifecycle } from "@/generated/prisma/client";
import {
  emptySearchResults,
  groupSearchHits,
  isSearchableQuery,
  normalizeSearchQuery,
  SEARCH_LIMIT_PER_KIND,
  searchQueryTokens,
  type SearchHit,
  type SearchResults,
} from "@/lib/crm/search";
import { COMPANY_LIFECYCLE_LABELS, OPPORTUNITY_STAGE_LABELS } from "@/lib/crm/constants";
import { prisma } from "@/lib/db/prisma";

function contains(term: string) {
  return { contains: term, mode: "insensitive" as const };
}

export type MatchingCompanyRow = {
  id: string;
  name: string;
  city: string | null;
  industry: string | null;
  lifecycleStatus: CompanyLifecycle;
  contacts: Array<{
    firstName: string;
    lastName: string;
    role: string | null;
    isPrimary: boolean;
  }>;
};

export type LoadMatchingCompaniesInput = {
  query: string;
  lifecycle?: CompanyLifecycle;
  city?: string;
  take: number;
};

/** Caller must authenticate. Same company text match as Ctrl+K, plus optional filters. */
export async function loadMatchingCompanies(
  input: LoadMatchingCompaniesInput,
): Promise<MatchingCompanyRow[]> {
  const query = normalizeSearchQuery(input.query);
  if (!isSearchableQuery(query)) {
    return [];
  }

  const cityFilter = input.city?.trim();

  return prisma.company.findMany({
    where: {
      AND: [
        {
          OR: [
            { name: contains(query) },
            { city: contains(query) },
            { industry: contains(query) },
            { email: contains(query) },
          ],
        },
        ...(input.lifecycle ? [{ lifecycleStatus: input.lifecycle }] : []),
        ...(cityFilter ? [{ city: contains(cityFilter) }] : []),
      ],
    },
    take: input.take,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      city: true,
      industry: true,
      lifecycleStatus: true,
      contacts: {
        orderBy: [{ isPrimary: "desc" as const }, { createdAt: "asc" as const }],
        take: 1,
        select: {
          firstName: true,
          lastName: true,
          role: true,
          isPrimary: true,
        },
      },
    },
  });
}

export async function loadSearchWorkspace(rawQuery: string): Promise<SearchResults> {
  const query = normalizeSearchQuery(rawQuery);
  if (!isSearchableQuery(query)) {
    return emptySearchResults(query);
  }

  const tokens = searchQueryTokens(query);
  const take = SEARCH_LIMIT_PER_KIND;

  const contactWhere =
    tokens.length <= 1
      ? {
          OR: [
            { firstName: contains(query) },
            { lastName: contains(query) },
            { email: contains(query) },
            { role: contains(query) },
          ],
        }
      : {
          AND: tokens.map((token) => ({
            OR: [
              { firstName: contains(token) },
              { lastName: contains(token) },
              { email: contains(token) },
              { role: contains(token) },
            ],
          })),
        };

  const [companies, contacts, projects, opportunities, documents] = await Promise.all([
    loadMatchingCompanies({ query, take }),
    prisma.contact.findMany({
      where: contactWhere,
      take,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        email: true,
        company: { select: { id: true, name: true } },
      },
    }),
    prisma.project.findMany({
      where: {
        OR: [{ name: contains(query) }, { description: contains(query) }],
      },
      take,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        status: true,
        company: { select: { name: true } },
      },
    }),
    prisma.opportunity.findMany({
      where: { title: contains(query) },
      take,
      orderBy: { title: "asc" },
      select: {
        id: true,
        title: true,
        stage: true,
        company: { select: { id: true, name: true } },
      },
    }),
    prisma.document.findMany({
      where: { name: contains(query) },
      take,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        type: true,
        companyId: true,
        projectId: true,
        company: { select: { name: true } },
        project: { select: { name: true } },
      },
    }),
  ]);

  const hits: SearchHit[] = [
    ...companies.map((company) => ({
      id: company.id,
      kind: "company" as const,
      title: company.name,
      subtitle: [
        COMPANY_LIFECYCLE_LABELS[company.lifecycleStatus],
        company.industry,
        company.city,
      ]
        .filter(Boolean)
        .join(" · "),
      href: `/entreprises/${company.id}`,
    })),
    ...contacts.map((contact) => ({
      id: contact.id,
      kind: "contact" as const,
      title: `${contact.firstName} ${contact.lastName}`.trim(),
      subtitle: [contact.role, contact.company.name, contact.email]
        .filter(Boolean)
        .join(" · "),
      href: `/entreprises/${contact.company.id}`,
    })),
    ...projects.map((project) => ({
      id: project.id,
      kind: "project" as const,
      title: project.name,
      subtitle: project.company.name,
      href: `/projets/${project.id}`,
    })),
    ...opportunities.map((opportunity) => ({
      id: opportunity.id,
      kind: "opportunity" as const,
      title: opportunity.title,
      subtitle: `${opportunity.company.name} · ${OPPORTUNITY_STAGE_LABELS[opportunity.stage]}`,
      href: `/entreprises/${opportunity.company.id}`,
    })),
    ...documents.map((document) => ({
      id: document.id,
      kind: "document" as const,
      title: document.name,
      subtitle: document.project?.name ?? document.company?.name ?? "Document",
      href: document.projectId
        ? `/projets/${document.projectId}`
        : document.companyId
          ? `/entreprises/${document.companyId}`
          : "/documents",
    })),
  ];

  return groupSearchHits(query, hits);
}

export async function searchWorkspace(rawQuery: string): Promise<SearchResults> {
  await requireAuthenticatedUser();
  return loadSearchWorkspace(rawQuery);
}
