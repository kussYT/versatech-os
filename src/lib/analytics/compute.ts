import type {
  CompanyLifecycle,
  InteractionType,
  MaintenanceStatus,
  OpportunityStage,
  PaymentStatus,
  ProjectStatus,
  QuoteStatus,
} from "@/generated/prisma/client";
import { ratePercent } from "@/lib/analytics/rates";
import {
  OPPORTUNITY_STAGES,
  isOpenOpportunityStage,
} from "@/lib/crm/constants";
import { effectiveProbability } from "@/lib/crm/probability";
import {
  analyticsPeriodRange,
  isInstantInRange,
  type AnalyticsPeriod,
  type InstantRange,
} from "@/lib/dates";
import { computeFinanceTotals } from "@/lib/finance";
import { computeMrr } from "@/lib/maintenance/mrr";
import { averageMoney, sumMoney, weightedMoney } from "@/lib/money";

const OUTREACH_TYPES: ReadonlySet<InteractionType> = new Set([
  "CALL",
  "EMAIL",
  "MEETING",
  "MESSAGE",
]);

const ACTIVE_PROJECT_STATUSES: ReadonlySet<ProjectStatus> = new Set([
  "ACTIVE",
  "WAITING_CLIENT",
  "REVIEW",
]);

export type AnalyticsCompanyRow = {
  createdAt: Date;
  lifecycleStatus: CompanyLifecycle;
};

export type AnalyticsInteractionRow = {
  occurredAt: Date;
  type: InteractionType;
};

export type AnalyticsOpportunityRow = {
  createdAt: Date;
  stage: OpportunityStage;
  estimatedValue: string;
  probability: number;
  wonAt: Date | null;
  lostAt: Date | null;
};

export type AnalyticsQuoteRow = {
  sentAt: Date | null;
  acceptedAt: Date | null;
  updatedAt: Date;
  status: QuoteStatus;
  amountIncTax: string;
};

export type AnalyticsProjectRow = {
  status: ProjectStatus;
  completedAt: Date | null;
};

export type AnalyticsPaymentRow = {
  amount: string;
  status: PaymentStatus;
  paidAt: Date | null;
};

export type AnalyticsContractRow = {
  monthlyAmount: string;
  status: MaintenanceStatus;
  startDate: Date;
  endDate: Date | null;
};

export type AnalyticsSnapshot = {
  companies: AnalyticsCompanyRow[];
  interactions: AnalyticsInteractionRow[];
  opportunities: AnalyticsOpportunityRow[];
  quotes: AnalyticsQuoteRow[];
  projects: AnalyticsProjectRow[];
  payments: AnalyticsPaymentRow[];
  contracts: AnalyticsContractRow[];
};

export type PipelineStageMix = {
  stage: OpportunityStage;
  count: number;
  brut: string;
};

export type AnalyticsReport = {
  period: AnalyticsPeriod;
  range: InstantRange;
  commercial: {
    prospectsCreated: number;
    contactsMade: number;
    calls: number;
    meetings: number;
    opportunitiesCreated: number;
    quotesSent: number;
    quotesAccepted: number;
    quotesRejected: number;
    quoteAcceptedRate: number | null;
    prospectToClientRate: number | null;
  };
  pipeline: {
    openCount: number;
    brut: string;
    weighted: string;
    won: number;
    lost: number;
    stages: PipelineStageMix[];
  };
  clients: {
    clients: number;
    activeProjects: number;
    completedProjects: number;
    averageAcceptedQuote: string | null;
  };
  finance: {
    signedRevenue: string;
    collected: string;
    remaining: string;
    expectedPayments: string;
    mrr: string;
  };
};

function inRange(instant: Date | null | undefined, range: InstantRange) {
  if (!instant) {
    return false;
  }

  return isInstantInRange(instant, range);
}

/**
 * KPIs lecture seule.
 *
 * Flux (période Paris) : créations, interactions, devis envoyés / acceptés /
 * refusés, opportunités gagnées / perdues, projets terminés, CA signé période
 * (acceptedAt), encaissements période (paidAt).
 *
 * Stocks (photo courante) : pipeline brut / pondéré, clients, projets actifs,
 * restant à encaisser = définition Finance (signé actuel − encaissé actuel),
 * paiements attendus = PENDING + OVERDUE, MRR officiel Maintenance.
 */
export function computeAnalytics(
  snapshot: AnalyticsSnapshot,
  period: AnalyticsPeriod,
  now = new Date(),
): AnalyticsReport {
  const range = analyticsPeriodRange(period, now);

  const createdCompanies = snapshot.companies.filter((company) =>
    inRange(company.createdAt, range),
  );
  const clientsCreated = createdCompanies.filter(
    (company) => company.lifecycleStatus === "CLIENT",
  ).length;

  const outreach = snapshot.interactions.filter(
    (interaction) =>
      OUTREACH_TYPES.has(interaction.type) && inRange(interaction.occurredAt, range),
  );
  const calls = outreach.filter((interaction) => interaction.type === "CALL").length;
  const meetings = outreach.filter((interaction) => interaction.type === "MEETING").length;

  const quotesSent = snapshot.quotes.filter((quote) => inRange(quote.sentAt, range));
  const quotesAcceptedFlow = snapshot.quotes.filter((quote) => inRange(quote.acceptedAt, range));
  const quotesRejected = snapshot.quotes.filter(
    (quote) => quote.status === "REJECTED" && inRange(quote.updatedAt, range),
  );
  const quotesAcceptedCohort = quotesSent.filter((quote) => quote.status === "ACCEPTED").length;

  const acceptedAmounts = quotesAcceptedFlow.map((quote) => quote.amountIncTax);
  const acceptedTotal = sumMoney(acceptedAmounts);
  const averageAccepted = averageMoney(acceptedTotal, quotesAcceptedFlow.length);

  const openOpportunities = snapshot.opportunities.filter((opportunity) =>
    isOpenOpportunityStage(opportunity.stage),
  );

  const pipelineBrut = sumMoney(openOpportunities.map((opportunity) => opportunity.estimatedValue));
  const pipelineWeighted = sumMoney(
    openOpportunities.map((opportunity) =>
      weightedMoney(
        opportunity.estimatedValue,
        effectiveProbability(opportunity.stage, opportunity.probability),
      ),
    ),
  );

  const stages: PipelineStageMix[] = OPPORTUNITY_STAGES.map((stage) => {
    const rows = snapshot.opportunities.filter((opportunity) => opportunity.stage === stage);
    return {
      stage,
      count: rows.length,
      brut: sumMoney(rows.map((row) => row.estimatedValue)),
    };
  });

  const won = snapshot.opportunities.filter(
    (opportunity) => opportunity.stage === "WON" && inRange(opportunity.wonAt, range),
  ).length;
  const lost = snapshot.opportunities.filter(
    (opportunity) => opportunity.stage === "LOST" && inRange(opportunity.lostAt, range),
  ).length;

  const collectedPeriod = sumMoney(
    snapshot.payments
      .filter((payment) => payment.status === "PAID" && inRange(payment.paidAt, range))
      .map((payment) => payment.amount),
  );

  const stock = computeFinanceTotals(
    snapshot.quotes
      .filter((quote) => quote.status === "ACCEPTED")
      .map((quote) => quote.amountIncTax),
    snapshot.payments.map((payment) => ({
      amount: payment.amount,
      status: payment.status,
    })),
    now,
  );

  const mrr = computeMrr(snapshot.contracts, now);

  return {
    period,
    range,
    commercial: {
      prospectsCreated: createdCompanies.length,
      contactsMade: outreach.length,
      calls,
      meetings,
      opportunitiesCreated: snapshot.opportunities.filter((opportunity) =>
        inRange(opportunity.createdAt, range),
      ).length,
      quotesSent: quotesSent.length,
      quotesAccepted: quotesAcceptedFlow.length,
      quotesRejected: quotesRejected.length,
      quoteAcceptedRate: ratePercent(quotesAcceptedCohort, quotesSent.length),
      prospectToClientRate: ratePercent(clientsCreated, createdCompanies.length),
    },
    pipeline: {
      openCount: openOpportunities.length,
      brut: pipelineBrut,
      weighted: pipelineWeighted,
      won,
      lost,
      stages,
    },
    clients: {
      clients: snapshot.companies.filter((company) => company.lifecycleStatus === "CLIENT")
        .length,
      activeProjects: snapshot.projects.filter((project) =>
        ACTIVE_PROJECT_STATUSES.has(project.status),
      ).length,
      completedProjects: snapshot.projects.filter(
        (project) => project.status === "COMPLETED" && inRange(project.completedAt, range),
      ).length,
      averageAcceptedQuote: averageAccepted,
    },
    finance: {
      signedRevenue: acceptedTotal,
      collected: collectedPeriod,
      remaining: stock.remaining,
      expectedPayments: sumMoney(
        snapshot.payments
          .filter((payment) => payment.status === "PENDING" || payment.status === "OVERDUE")
          .map((payment) => payment.amount),
      ),
      mrr: mrr.mrr,
    },
  };
}
