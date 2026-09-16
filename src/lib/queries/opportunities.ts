import "server-only";

import type { InteractionType, OpportunityStage } from "@/generated/prisma/client";
import {
  OPPORTUNITY_STAGES,
  isOpenOpportunityStage,
} from "@/lib/crm/constants";
import { prisma } from "@/lib/db/prisma";

export type PipelineOpportunityCard = {
  id: string;
  title: string;
  stage: OpportunityStage;
  estimatedValue: string;
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
};

export type PipelineOverview = {
  counts: Record<OpportunityStage, number>;
  openCount: number;
  brutTotal: number;
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

function loadOpportunities() {
  return prisma.opportunity.findMany({
    orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
    include: {
      company: {
        select: {
          id: true,
          name: true,
          industry: true,
          city: true,
          followUps: {
            where: { status: "PENDING" },
            orderBy: { dueAt: "asc" },
            take: 1,
            select: { title: true, dueAt: true },
          },
          interactions: {
            orderBy: { occurredAt: "desc" },
            take: 1,
            select: { type: true, occurredAt: true },
          },
        },
      },
      followUps: {
        where: { status: "PENDING" },
        orderBy: { dueAt: "asc" },
        take: 1,
        select: { title: true, dueAt: true },
      },
      interactions: {
        orderBy: { occurredAt: "desc" },
        take: 1,
        select: { type: true, occurredAt: true },
      },
    },
  });
}

export async function listPipelineBoard(): Promise<PipelineColumn[]> {
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
    };
  });
}

export async function getPipelineOverview(): Promise<PipelineOverview> {
  const grouped = await prisma.opportunity.groupBy({
    by: ["stage"],
    _count: { _all: true },
    _sum: { estimatedValue: true },
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

  return { counts, openCount, brutTotal };
}
