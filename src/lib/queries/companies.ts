import "server-only";

import { requireAuthenticatedUser } from "@/lib/auth/dal";

import type {
  CompanyLifecycle,
  FollowUpStatus,
  GeocodeStatus,
  InteractionDirection,
  InteractionResult,
  InteractionType,
  MaintenanceStatus,
  OpportunityStage,
  Priority,
  ProjectStatus,
  QuoteStatus,
} from "@/generated/prisma/client";
import {
  OPEN_OPPORTUNITY_STAGES,
  PROSPECT_LIFECYCLES,
  projectProgress,
} from "@/lib/crm/constants";
import { allowedManualLifecycles, type CompanyLifecycleFacts } from "@/lib/crm/lifecycle";
import { endOfToday } from "@/lib/crm/form-data";
import { computeFinanceTotals, effectivePaymentStatus, type FinanceTotals } from "@/lib/finance";
import { prisma } from "@/lib/db/prisma";
import {
  listDocumentsForCompany,
  type DocumentRecord,
} from "@/lib/queries/documents";
import type { PaymentListItem } from "@/lib/queries/payments";
import {
  listMaintenanceContractsForCompany,
  type MaintenanceContractItem,
} from "@/lib/queries/maintenance";
import {
  buildClientJourney,
  toClientJourneyInput,
  type ClientJourney,
} from "@/lib/client-journey";
import {
  selectPrincipalProject,
  type PrincipalProjectSource,
} from "@/lib/projects/principal";
import { buildWebsiteStatus, type WebsiteStatusView } from "@/lib/website/status";

const listInclude = {
  contacts: {
    orderBy: [{ isPrimary: "desc" as const }, { createdAt: "asc" as const }],
    take: 8,
  },
  interactions: {
    orderBy: { occurredAt: "desc" as const },
    take: 1,
    select: { occurredAt: true, type: true },
  },
  followUps: {
    where: { status: "PENDING" as FollowUpStatus },
    orderBy: { dueAt: "asc" as const },
    take: 1,
    select: { dueAt: true, title: true },
  },
};

export type CompanyListItem = {
  id: string;
  name: string;
  lifecycleStatus: CompanyLifecycle;
  industry: string | null;
  city: string | null;
  priority: Priority;
  source: string | null;
  primaryContact: {
    firstName: string;
    lastName: string;
    role: string | null;
  } | null;
  lastInteractionAt: string | null;
  lastInteractionType: InteractionType | null;
  nextFollowUpAt: string | null;
  nextFollowUpTitle: string | null;
};

export type CompanyDetail = {
  id: string;
  name: string;
  lifecycleStatus: CompanyLifecycle;
  industry: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  source: string | null;
  priority: Priority;
  description: string | null;
  commercialBrief: unknown;
  latitude: number | null;
  longitude: number | null;
  geocodeStatus: GeocodeStatus | null;
  contacts: {
    id: string;
    firstName: string;
    lastName: string;
    role: string | null;
    phone: string | null;
    email: string | null;
    isPrimary: boolean;
  }[];
  interactions: {
    id: string;
    type: InteractionType;
    direction: InteractionDirection;
    result: InteractionResult | null;
    notes: string | null;
    subject: string | null;
    occurredAt: string;
  }[];
  nextFollowUp: {
    id: string;
    title: string;
    dueAt: string;
    status: FollowUpStatus;
  } | null;
  hasOpenOpportunity: boolean;
  opportunities: {
    id: string;
    title: string;
    stage: OpportunityStage;
    estimatedValue: string;
    updatedAt: string;
  }[];
  quotes: {
    id: string;
    reference: string;
    status: QuoteStatus;
    amountIncTax: string;
    createdAt: string;
    sentAt: string | null;
    acceptedAt: string | null;
    projectId: string | null;
    opportunityId: string;
  }[];
  quoteOpportunities: {
    id: string;
    title: string;
    stage: OpportunityStage;
  }[];
  projects: {
    id: string;
    name: string;
    status: ProjectStatus;
    dueDate: string | null;
    startDate: string | null;
    completedAt: string | null;
    createdAt: string;
    updatedAt: string;
    opportunityId: string | null;
    progress: number;
  }[];
  principalProject: {
    id: string;
    name: string;
    status: ProjectStatus;
    source: PrincipalProjectSource;
  } | null;
  journey: ClientJourney;
  websiteStatus: WebsiteStatusView;
  acceptedQuotes: {
    id: string;
    reference: string;
    amountIncTax: string;
  }[];
  payments: PaymentListItem[];
  finance: FinanceTotals;
  documents: DocumentRecord[];
  maintenanceContracts: MaintenanceContractItem[];
  allowedLifecycleStatuses: CompanyLifecycle[];
};

function toListItem(
  company: Awaited<ReturnType<typeof prisma.company.findMany<{ include: typeof listInclude }>>>[number],
): CompanyListItem {
  const lastInteraction = company.interactions[0] ?? null;
  const nextFollowUp = company.followUps[0] ?? null;
  const primary =
    company.contacts.find((contact) => contact.isPrimary) ?? company.contacts[0] ?? null;

  return {
    id: company.id,
    name: company.name,
    lifecycleStatus: company.lifecycleStatus,
    industry: company.industry,
    city: company.city,
    priority: company.priority,
    source: company.source,
    primaryContact: primary
      ? {
          firstName: primary.firstName,
          lastName: primary.lastName,
          role: primary.role,
        }
      : null,
    lastInteractionAt: lastInteraction?.occurredAt.toISOString() ?? null,
    lastInteractionType: lastInteraction?.type ?? null,
    nextFollowUpAt: nextFollowUp?.dueAt.toISOString() ?? null,
    nextFollowUpTitle: nextFollowUp?.title ?? null,
  };
}

export async function listProspectCompanies() {
  await requireAuthenticatedUser();
  const companies = await prisma.company.findMany({
    where: { lifecycleStatus: { in: [...PROSPECT_LIFECYCLES] } },
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    include: listInclude,
  });

  return companies.map(toListItem);
}

/** Caller must authenticate. LEAD file, same take as the dashboard. */
export async function loadCompaniesToCall(limit = 5) {
  const companies = await prisma.company.findMany({
    where: { lifecycleStatus: "LEAD" },
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    take: limit,
    include: listInclude,
  });

  return companies.map(toListItem);
}

export async function listCompaniesToCall(limit = 5) {
  await requireAuthenticatedUser();
  return loadCompaniesToCall(limit);
}

/** Caller must authenticate. */
export async function loadAllCompanies() {
  const companies = await prisma.company.findMany({
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    include: listInclude,
  });

  return companies.map(toListItem);
}

export async function listAllCompanies() {
  await requireAuthenticatedUser();
  return loadAllCompanies();
}

/** Caller must authenticate. */
export async function loadCompanyExists(id: string): Promise<boolean> {
  const row = await prisma.company.findUnique({
    where: { id },
    select: { id: true },
  });
  return row != null;
}

export async function getProspectionSummary() {
  await requireAuthenticatedUser();
  const dueLimit = endOfToday();

  const [active, toContact, dueFollowUps] = await Promise.all([
    prisma.company.count({
      where: { lifecycleStatus: { in: [...PROSPECT_LIFECYCLES] } },
    }),
    prisma.company.count({
      where: { lifecycleStatus: "LEAD" },
    }),
    prisma.followUp.count({
      where: {
        status: "PENDING",
        dueAt: { lte: dueLimit },
        company: { lifecycleStatus: { in: [...PROSPECT_LIFECYCLES] } },
      },
    }),
  ]);

  return { active, toContact, dueFollowUps };
}

export const COMPANY_COMPACT_LOAD_LIMITS = {
  contacts: 8,
  openOpportunities: 8,
  projects: 20,
  maintenanceContracts: 20,
} as const;

export type CompanyCompactLoad = {
  id: string;
  name: string;
  lifecycleStatus: CompanyLifecycle;
  industry: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  source: string | null;
  priority: Priority;
  description: string | null;
  commercialBrief: unknown;
  geocodeStatus: GeocodeStatus | null;
  contacts: {
    id: string;
    firstName: string;
    lastName: string;
    role: string | null;
    phone: string | null;
    email: string | null;
    isPrimary: boolean;
  }[];
  lastInteraction: {
    id: string;
    type: InteractionType;
    direction: InteractionDirection;
    result: InteractionResult | null;
    notes: string | null;
    subject: string | null;
    occurredAt: Date;
  } | null;
  nextFollowUp: {
    id: string;
    title: string;
    dueAt: Date;
    status: FollowUpStatus;
  } | null;
  openOpportunities: {
    id: string;
    title: string;
    stage: OpportunityStage;
    estimatedValue: string;
    updatedAt: Date;
  }[];
  projects: {
    id: string;
    name: string;
    status: ProjectStatus;
    startDate: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  maintenanceContracts: {
    id: string;
    status: MaintenanceStatus;
    monthlyAmount: string;
    startDate: Date;
    projectId: string | null;
  }[];
};

/** Caller must authenticate. Compact projection — not the hub. */
export async function loadCompanyCompact(id: string): Promise<CompanyCompactLoad | null> {
  const company = await prisma.company.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      lifecycleStatus: true,
      industry: true,
      website: true,
      phone: true,
      email: true,
      address: true,
      city: true,
      postalCode: true,
      country: true,
      source: true,
      priority: true,
      description: true,
      commercialBrief: true,
      geocodeStatus: true,
      contacts: {
        orderBy: [{ isPrimary: "desc" as const }, { createdAt: "asc" as const }],
        take: COMPANY_COMPACT_LOAD_LIMITS.contacts,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
          phone: true,
          email: true,
          isPrimary: true,
        },
      },
      interactions: {
        orderBy: { occurredAt: "desc" as const },
        take: 1,
        select: {
          id: true,
          type: true,
          direction: true,
          result: true,
          notes: true,
          subject: true,
          occurredAt: true,
        },
      },
      followUps: {
        where: { status: "PENDING" as FollowUpStatus },
        orderBy: { dueAt: "asc" as const },
        take: 1,
        select: { id: true, title: true, dueAt: true, status: true },
      },
      opportunities: {
        where: { stage: { in: [...OPEN_OPPORTUNITY_STAGES] } },
        orderBy: { updatedAt: "desc" as const },
        take: COMPANY_COMPACT_LOAD_LIMITS.openOpportunities,
        select: {
          id: true,
          title: true,
          stage: true,
          estimatedValue: true,
          updatedAt: true,
        },
      },
      projects: {
        orderBy: { createdAt: "desc" as const },
        take: COMPANY_COMPACT_LOAD_LIMITS.projects,
        select: {
          id: true,
          name: true,
          status: true,
          startDate: true,
          completedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      maintenanceContracts: {
        orderBy: [{ status: "asc" as const }, { startDate: "desc" as const }],
        take: COMPANY_COMPACT_LOAD_LIMITS.maintenanceContracts,
        select: {
          id: true,
          status: true,
          monthlyAmount: true,
          startDate: true,
          projectId: true,
        },
      },
    },
  });

  if (!company) {
    return null;
  }

  return {
    id: company.id,
    name: company.name,
    lifecycleStatus: company.lifecycleStatus,
    industry: company.industry,
    website: company.website,
    phone: company.phone,
    email: company.email,
    address: company.address,
    city: company.city,
    postalCode: company.postalCode,
    country: company.country,
    source: company.source,
    priority: company.priority,
    description: company.description,
    commercialBrief: company.commercialBrief,
    geocodeStatus: company.geocodeStatus,
    contacts: company.contacts,
    lastInteraction: company.interactions[0] ?? null,
    nextFollowUp: company.followUps[0] ?? null,
    openOpportunities: company.opportunities.map((opportunity) => ({
      id: opportunity.id,
      title: opportunity.title,
      stage: opportunity.stage,
      estimatedValue: opportunity.estimatedValue.toString(),
      updatedAt: opportunity.updatedAt,
    })),
    projects: company.projects,
    maintenanceContracts: company.maintenanceContracts.map((contract) => ({
      id: contract.id,
      status: contract.status,
      monthlyAmount: contract.monthlyAmount.toString(),
      startDate: contract.startDate,
      projectId: contract.projectId,
    })),
  };
}

/** Caller must authenticate. Full hub for `/entreprises/[id]`. */
export async function loadCompanyDetail(id: string): Promise<CompanyDetail | null> {
  await requireAuthenticatedUser();
  const [company, documents, maintenanceContracts] = await Promise.all([
    prisma.company.findUnique({
      where: { id },
      include: {
      contacts: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
      interactions: {
        orderBy: { occurredAt: "desc" },
      },
      followUps: {
        where: { status: "PENDING" },
        orderBy: { dueAt: "asc" },
        take: 1,
      },
      opportunities: {
        select: { id: true, title: true, stage: true, estimatedValue: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      },
      quotes: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          reference: true,
          status: true,
          amountIncTax: true,
          createdAt: true,
          sentAt: true,
          acceptedAt: true,
          projectId: true,
          opportunityId: true,
        },
      },
      payments: {
        orderBy: { createdAt: "desc" },
        include: {
          quote: { select: { id: true, reference: true, status: true } },
          project: { select: { id: true, name: true } },
        },
      },
      projects: {
        orderBy: { createdAt: "desc" },
        include: {
          tasks: { select: { status: true } },
        },
      },
    },
      }),
    listDocumentsForCompany(id),
    listMaintenanceContractsForCompany(id),
  ]);

  if (!company) {
    return null;
  }

  const nextFollowUp = company.followUps[0] ?? null;
  const now = new Date();
  const journeyInput = toClientJourneyInput({
    interactions: company.interactions,
    quotes: company.quotes.map((quote) => ({
      id: quote.id,
      reference: quote.reference,
      status: quote.status,
      amountIncTax: quote.amountIncTax.toString(),
      createdAt: quote.createdAt,
      sentAt: quote.sentAt,
      acceptedAt: quote.acceptedAt,
      projectId: quote.projectId,
      opportunityId: quote.opportunityId,
    })),
    projects: company.projects.map((project) => ({
      id: project.id,
      name: project.name,
      status: project.status,
      startDate: project.startDate,
      completedAt: project.completedAt,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      opportunityId: project.opportunityId,
    })),
    payments: company.payments.map((payment) => ({
      id: payment.id,
      amount: payment.amount.toString(),
      status: payment.status,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
      quoteId: payment.quote?.id ?? null,
      projectId: payment.project?.id ?? null,
    })),
    contracts: maintenanceContracts,
    opportunities: company.opportunities,
  });
  const principal = selectPrincipalProject(journeyInput.projects, journeyInput.contracts, { now });
  const journey = buildClientJourney(journeyInput, { now });
  const websiteStatus = buildWebsiteStatus({
    website: company.website,
    projects: journeyInput.projects,
    contracts: journeyInput.contracts,
    now,
  });

  return {
    id: company.id,
    name: company.name,
    lifecycleStatus: company.lifecycleStatus,
    industry: company.industry,
    website: company.website,
    phone: company.phone,
    email: company.email,
    address: company.address,
    city: company.city,
    postalCode: company.postalCode,
    country: company.country,
    source: company.source,
    priority: company.priority,
    description: company.description,
    commercialBrief: company.commercialBrief,
    latitude: company.latitude,
    longitude: company.longitude,
    geocodeStatus: company.geocodeStatus,
    contacts: company.contacts.map((contact) => ({
      id: contact.id,
      firstName: contact.firstName,
      lastName: contact.lastName,
      role: contact.role,
      phone: contact.phone,
      email: contact.email,
      isPrimary: contact.isPrimary,
    })),
    interactions: company.interactions.map((interaction) => ({
      id: interaction.id,
      type: interaction.type,
      direction: interaction.direction,
      result: interaction.result,
      notes: interaction.notes,
      subject: interaction.subject,
      occurredAt: interaction.occurredAt.toISOString(),
    })),
    nextFollowUp: nextFollowUp
      ? {
          id: nextFollowUp.id,
          title: nextFollowUp.title,
          dueAt: nextFollowUp.dueAt.toISOString(),
          status: nextFollowUp.status,
        }
      : null,
    hasOpenOpportunity: company.opportunities.some((opportunity) =>
      (OPEN_OPPORTUNITY_STAGES as readonly OpportunityStage[]).includes(opportunity.stage),
    ),
    quotes: company.quotes.map((quote) => ({
      id: quote.id,
      reference: quote.reference,
      status: quote.status,
      amountIncTax: quote.amountIncTax.toString(),
      createdAt: quote.createdAt.toISOString(),
      sentAt: quote.sentAt?.toISOString() ?? null,
      acceptedAt: quote.acceptedAt?.toISOString() ?? null,
      projectId: quote.projectId,
      opportunityId: quote.opportunityId,
    })),
    quoteOpportunities: company.opportunities
      .filter((opportunity) =>
        (OPEN_OPPORTUNITY_STAGES as readonly OpportunityStage[]).includes(opportunity.stage),
      )
      .map((opportunity) => ({
        id: opportunity.id,
        title: opportunity.title,
        stage: opportunity.stage,
      })),
    opportunities: company.opportunities.map((opportunity) => ({
      id: opportunity.id,
      title: opportunity.title,
      stage: opportunity.stage,
      estimatedValue: opportunity.estimatedValue.toString(),
      updatedAt: opportunity.updatedAt.toISOString(),
    })),
    projects: company.projects.map((project) => ({
      id: project.id,
      name: project.name,
      status: project.status,
      dueDate: project.dueDate?.toISOString() ?? null,
      startDate: project.startDate?.toISOString() ?? null,
      completedAt: project.completedAt?.toISOString() ?? null,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      opportunityId: project.opportunityId,
      progress: projectProgress(project.tasks),
    })),
    acceptedQuotes: company.quotes
      .filter((quote) => quote.status === "ACCEPTED" && !quote.projectId)
      .map((quote) => ({
        id: quote.id,
        reference: quote.reference,
        amountIncTax: quote.amountIncTax.toString(),
      })),
    payments: company.payments.map((payment) => ({
      id: payment.id,
      label: payment.label,
      amount: payment.amount.toString(),
      status: payment.status,
      effectiveStatus: effectivePaymentStatus(payment.status, payment.dueAt),
      dueAt: payment.dueAt?.toISOString() ?? null,
      paidAt: payment.paidAt?.toISOString() ?? null,
      externalReference: payment.externalReference,
      createdAt: payment.createdAt.toISOString(),
      company: { id: company.id, name: company.name },
      quote: payment.quote,
      project: payment.project,
    })),
    finance: computeFinanceTotals(
      company.quotes
        .filter((quote) => quote.status === "ACCEPTED")
        .map((quote) => quote.amountIncTax.toString()),
      company.payments.map((payment) => ({
        amount: payment.amount.toString(),
        status: payment.status,
        dueAt: payment.dueAt,
      })),
    ),
    documents,
    maintenanceContracts,
    principalProject: principal
      ? {
          id: principal.project.id,
          name: principal.project.name,
          status: principal.project.status,
          source: principal.source,
        }
      : null,
    journey,
    websiteStatus,
    allowedLifecycleStatuses: allowedManualLifecycles({
      current: company.lifecycleStatus,
      wonOpportunityCount: company.opportunities.filter((opportunity) => opportunity.stage === "WON")
        .length,
      acceptedQuoteCount: company.quotes.filter((quote) => quote.status === "ACCEPTED").length,
      projectCount: company.projects.length,
      openOpportunityCount: company.opportunities.filter((opportunity) =>
        (OPEN_OPPORTUNITY_STAGES as readonly OpportunityStage[]).includes(opportunity.stage),
      ).length,
    } satisfies CompanyLifecycleFacts),
  };
}

export async function getCompanyDetail(id: string): Promise<CompanyDetail | null> {
  await requireAuthenticatedUser();
  return loadCompanyDetail(id);
}
