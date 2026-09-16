import "server-only";

import type {
  CompanyLifecycle,
  FollowUpStatus,
  InteractionDirection,
  InteractionResult,
  InteractionType,
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
  }[];
  quotes: {
    id: string;
    reference: string;
    status: QuoteStatus;
    amountIncTax: string;
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
    progress: number;
  }[];
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
  const companies = await prisma.company.findMany({
    where: { lifecycleStatus: { in: [...PROSPECT_LIFECYCLES] } },
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    include: listInclude,
  });

  return companies.map(toListItem);
}

export async function listCompaniesToCall(limit = 5) {
  const companies = await prisma.company.findMany({
    where: { lifecycleStatus: "LEAD" },
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    take: limit,
    include: listInclude,
  });

  return companies.map(toListItem);
}

export async function listAllCompanies() {
  const companies = await prisma.company.findMany({
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    include: listInclude,
  });

  return companies.map(toListItem);
}

export async function getProspectionSummary() {
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

export async function getCompanyDetail(id: string): Promise<CompanyDetail | null> {
  const [company, documents, maintenanceContracts] = await Promise.all([
    prisma.company.findUnique({
      where: { id },
      include: {
      contacts: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
      interactions: {
        orderBy: { occurredAt: "desc" },
        take: 80,
      },
      followUps: {
        where: { status: "PENDING" },
        orderBy: { dueAt: "asc" },
        take: 1,
      },
      opportunities: {
        select: { id: true, title: true, stage: true, estimatedValue: true },
        orderBy: { updatedAt: "desc" },
      },
      quotes: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          reference: true,
          status: true,
          amountIncTax: true,
          projectId: true,
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
    })),
    projects: company.projects.map((project) => ({
      id: project.id,
      name: project.name,
      status: project.status,
      dueDate: project.dueDate?.toISOString() ?? null,
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
