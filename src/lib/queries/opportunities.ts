import "server-only";

import { requireAuthenticatedUser } from "@/lib/auth/dal";

import type { InteractionType, OpportunityStage } from "@/generated/prisma/client";
import {
  OPEN_OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGES,
  isOpenOpportunityStage,
} from "@/lib/crm/constants";
import { effectiveProbability, weightedValue } from "@/lib/crm/probability";
import { prisma } from "@/lib/db/prisma";
import { centsToMoneyString, sumMoney, tryParseMoneyToCents, weightedMoney, ZERO_MONEY } from "@/lib/money";
import { KANBAN_PAGE_SIZE } from "@/lib/pipeline/kanban";

export type PipelineOpportunityCard = {
  id: string;
  title: string;
  stage: OpportunityStage;
  estimatedValue: string;
  probability: number;
  company: {
    id: string;
    name: string;
    industry: string | null;
    city: string | null;
  };
  nextFollowUp: {
    title: string;
    dueAt: string;
  } | null;
  lastInteraction: {
    type: InteractionType;
    occurredAt: string;
  } | null;
};

export type PipelineColumn = {
  stage: OpportunityStage;
  opportunities: PipelineOpportunityCard[];
  count: number;
  estimatedTotal: number;
  weightedTotal: number;
};

export type PipelineOverview = {
  counts: Record<OpportunityStage, number>;
  openCount: number;
  brutTotal: number;
  weightedTotal: number;
};

/** Dashboard numbers plus money.ts strings for TodayService (agent DTO). */
export type PipelineOverviewLoad = PipelineOverview & {
  brutTotalMoney: string;
  weightedTotalMoney: string;
};

function decimalToNumber(value: { toString(): string } | null | undefined) {
  if (!value) {
    return 0;
  }

  const amount = Number(value.toString());
  return Number.isFinite(amount) ? amount : 0;
}

function toCard(
  opportunity: Awaited<ReturnType<typeof loadOpportunities>>[number],
): PipelineOpportunityCard {
  const nextFollowUp = opportunity.followUps[0] ?? opportunity.company.followUps[0] ?? null;
  const lastInteraction =
    opportunity.interactions[0] ?? opportunity.company.interactions[0] ?? null;

  return {
    id: opportunity.id,
    title: opportunity.title,
    stage: opportunity.stage,
    estimatedValue: opportunity.estimatedValue.toString(),
    probability: effectiveProbability(opportunity.stage, opportunity.probability),
    company: {
      id: opportunity.company.id,
      name: opportunity.company.name,
      industry: opportunity.company.industry,
      city: opportunity.company.city,
    },
    nextFollowUp: nextFollowUp
      ? {
          title: nextFollowUp.title,
          dueAt: nextFollowUp.dueAt.toISOString(),
        }
      : null,
    lastInteraction: lastInteraction
      ? {
          type: lastInteraction.type,
          occurredAt: lastInteraction.occurredAt.toISOString(),
        }
      : null,
  };
}

const opportunityCardInclude = {
  company: {
    select: {
      id: true,
      name: true,
      industry: true,
      city: true,
      followUps: {
        where: { status: "PENDING" as const },
        orderBy: { dueAt: "asc" as const },
        take: 1,
        select: { title: true, dueAt: true },
      },
      interactions: {
        orderBy: { occurredAt: "desc" as const },
        take: 1,
        select: { type: true, occurredAt: true },
      },
    },
  },
  followUps: {
    where: { status: "PENDING" as const },
    orderBy: { dueAt: "asc" as const },
    take: 1,
    select: { title: true, dueAt: true },
  },
  interactions: {
    orderBy: { occurredAt: "desc" as const },
    take: 1,
    select: { type: true, occurredAt: true },
  },
} as const;

function loadOpportunities(options?: { stage?: OpportunityStage; take?: number; skip?: number }) {
  return prisma.opportunity.findMany({
    where: options?.stage ? { stage: options.stage } : undefined,
    ...(options?.take != null ? { take: options.take } : {}),
    ...(options?.skip ? { skip: options.skip } : {}),
    orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
    include: opportunityCardInclude,
  });
}

export type PipelineValueRow = {
  stage: OpportunityStage;
  estimatedValue: string;
  probability: number;
};

/** Caller must authenticate. Lightweight rows for money.ts stage totals (not the board dump). */
export async function loadPipelineValueRows(): Promise<PipelineValueRow[]> {
  const rows = await prisma.opportunity.findMany({
    select: { stage: true, estimatedValue: true, probability: true },
  });

  return rows.map((row) => ({
    stage: row.stage,
    estimatedValue: row.estimatedValue.toString(),
    probability: effectiveProbability(row.stage, row.probability),
  }));
}

/** Caller must authenticate. SQL `take` per stage — do not dump the UI board. */
export async function loadPipelineStageCards(
  stage: OpportunityStage,
  take: number,
): Promise<PipelineOpportunityCard[]> {
  const opportunities = await loadOpportunities({ stage, take });
  return opportunities.map(toCard);
}

export async function listPipelineBoard(): Promise<PipelineColumn[]> {
  await requireAuthenticatedUser();
  const opportunities = await loadOpportunities();
  const cards = opportunities.map(toCard);

  return OPPORTUNITY_STAGES.map((stage) => {
    const columnCards = cards.filter((card) => card.stage === stage);
    return {
      stage,
      opportunities: columnCards,
      count: columnCards.length,
      estimatedTotal: columnCards.reduce(
        (sum, card) => sum + decimalToNumber(card.estimatedValue),
        0,
      ),
      weightedTotal: columnCards.reduce(
        (sum, card) =>
          sum + weightedValue(decimalToNumber(card.estimatedValue), card.probability),
        0,
      ),
    };
  });
}

/** Caller must authenticate. Number totals stay dashboard-identical; money strings use money.ts. */
export async function loadPipelineOverview(): Promise<PipelineOverviewLoad> {
  const grouped = await prisma.opportunity.groupBy({
    by: ["stage"],
    _count: { _all: true },
    _sum: { estimatedValue: true },
  });

  const openOpportunities = await prisma.opportunity.findMany({
    where: { stage: { in: [...OPEN_OPPORTUNITY_STAGES] } },
    select: { stage: true, estimatedValue: true, probability: true },
  });

  const counts = Object.fromEntries(
    OPPORTUNITY_STAGES.map((stage) => [stage, 0]),
  ) as Record<OpportunityStage, number>;

  let openCount = 0;
  let brutTotal = 0;

  for (const row of grouped) {
    counts[row.stage] = row._count._all;
    if (isOpenOpportunityStage(row.stage)) {
      openCount += row._count._all;
      brutTotal += decimalToNumber(row._sum.estimatedValue);
    }
  }

  const weightedTotal = openOpportunities.reduce((sum, opportunity) => {
    return (
      sum +
      weightedValue(
        decimalToNumber(opportunity.estimatedValue),
        effectiveProbability(opportunity.stage, opportunity.probability),
      )
    );
  }, 0);

  let brutCents = BigInt(0);
  let weightedCents = BigInt(0);
  for (const opportunity of openOpportunities) {
    const amount = opportunity.estimatedValue.toString();
    const cents = tryParseMoneyToCents(amount);
    if (cents === null) {
      continue;
    }
    brutCents += cents;
    try {
      const weighted = tryParseMoneyToCents(
        weightedMoney(amount, effectiveProbability(opportunity.stage, opportunity.probability)),
      );
      if (weighted !== null) {
        weightedCents += weighted;
      }
    } catch {
      continue;
    }
  }

  return {
    counts,
    openCount,
    brutTotal,
    weightedTotal,
    brutTotalMoney: centsToMoneyString(brutCents),
    weightedTotalMoney: centsToMoneyString(weightedCents),
  };
}

export type KanbanColumnLoad = {
  stage: OpportunityStage;
  count: number;
  estimatedValue: string;
  opportunities: PipelineOpportunityCard[];
};

export type KanbanBoardLoad = {
  columns: KanbanColumnLoad[];
  openEstimated: string;
};

function moneyString(value: { toString(): string } | null | undefined) {
  const raw = value ? value.toString() : ZERO_MONEY;
  const cents = tryParseMoneyToCents(raw);
  return cents === null ? ZERO_MONEY : centsToMoneyString(cents);
}

export async function loadKanbanBoard(): Promise<KanbanBoardLoad> {
  await requireAuthenticatedUser();
  const [grouped, ...pages] = await Promise.all([
    prisma.opportunity.groupBy({
      by: ["stage"],
      _count: { _all: true },
      _sum: { estimatedValue: true },
    }),
    ...OPPORTUNITY_STAGES.map((stage) => loadOpportunities({ stage, take: KANBAN_PAGE_SIZE })),
  ]);

  const totals = new Map(grouped.map((row) => [row.stage, row]));
  const columns = OPPORTUNITY_STAGES.map((stage, index) => {
    const row = totals.get(stage);
    return {
      stage,
      count: row?._count._all ?? 0,
      estimatedValue: moneyString(row?._sum.estimatedValue),
      opportunities: (pages[index] ?? []).map(toCard),
    };
  });

  return {
    columns,
    openEstimated: sumMoney(
      columns.filter((column) => isOpenOpportunityStage(column.stage)).map((column) => column.estimatedValue),
    ),
  };
}

export async function loadKanbanColumnPage(stage: OpportunityStage, skip: number) {
  await requireAuthenticatedUser();
  const opportunities = await loadOpportunities({
    stage,
    take: KANBAN_PAGE_SIZE,
    skip: Math.max(0, skip),
  });
  return opportunities.map(toCard);
}

export async function loadOpportunityQuickView(opportunityId: string) {
  await requireAuthenticatedUser();
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    select: {
      id: true,
      title: true,
      stage: true,
      estimatedValue: true,
      company: {
        select: {
          id: true,
          name: true,
          lifecycleStatus: true,
          phone: true,
          email: true,
          instagram: true,
        },
      },
      quotes: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { id: true, reference: true, status: true, amountIncTax: true },
      },
      interactions: {
        orderBy: { occurredAt: "desc" },
        take: 1,
        select: { type: true, occurredAt: true, subject: true },
      },
      followUps: {
        where: { status: "PENDING" },
        orderBy: { dueAt: "asc" },
        take: 1,
        select: { title: true, dueAt: true },
      },
    },
  });
  if (!opportunity) {
    return null;
  }
  const quote = opportunity.quotes[0] ?? null;
  const interaction = opportunity.interactions[0] ?? null;
  const followUp = opportunity.followUps[0] ?? null;
  return {
    opportunityId: opportunity.id,
    title: opportunity.title,
    stage: opportunity.stage,
    estimatedValue: moneyString(opportunity.estimatedValue),
    company: opportunity.company,
    latestQuote: quote
      ? {
          id: quote.id,
          reference: quote.reference,
          status: quote.status,
          amountIncTax: moneyString(quote.amountIncTax),
        }
      : null,
    lastInteraction: interaction
      ? {
          type: interaction.type,
          occurredAt: interaction.occurredAt.toISOString(),
          subject: interaction.subject,
        }
      : null,
    nextFollowUp: followUp
      ? { title: followUp.title, dueAt: followUp.dueAt.toISOString() }
      : null,
  };
}

export async function getPipelineOverview(): Promise<PipelineOverview> {
  await requireAuthenticatedUser();
  const loaded = await loadPipelineOverview();
  return {
    counts: loaded.counts,
    openCount: loaded.openCount,
    brutTotal: loaded.brutTotal,
    weightedTotal: loaded.weightedTotal,
  };
}
