import "server-only";

import { requireAuthenticatedUser } from "@/lib/auth/dal";
import { OPEN_OPPORTUNITY_STAGES, PROSPECT_LIFECYCLES } from "@/lib/crm/constants";
import {
  buildOperationsDashboard,
  type OperationsDashboard,
  type OperationsFollowUp,
  type OperationsOpportunity,
  type OperationsQuote,
} from "@/lib/dashboard/operations";
import { addCivilDays, endOfToday, fromParisDateTime, parisParts, startOfToday } from "@/lib/dates";
import { prisma } from "@/lib/db/prisma";
import { ZERO_MONEY } from "@/lib/money";

const PENDING_FOLLOW_UP_TAKE = 200;
const QUOTE_TAKE = 80;
const PROSPECT_TAKE = 20;
const OPPORTUNITY_TAKE = 40;

function money(value: { toString(): string } | null | undefined) {
  return value ? value.toString() : ZERO_MONEY;
}

export async function loadOperationsDashboard(now = new Date()): Promise<OperationsDashboard> {
  await requireAuthenticatedUser();
  const parts = parisParts(now);
  const recent = addCivilDays(parts.year, parts.month, parts.day, -14);

  const dayStart = startOfToday(now);
  const dayEnd = endOfToday(now);
  const [followUps, quotes, prospects, opportunities, pipeline, activeProspects, overdueFollowUps, todayFollowUps, waitingQuoteCount] =
    await Promise.all([
    prisma.followUp.findMany({
      where: { status: "PENDING" },
      orderBy: { dueAt: "asc" },
      take: PENDING_FOLLOW_UP_TAKE,
      select: {
        id: true,
        title: true,
        dueAt: true,
        status: true,
        companyId: true,
        opportunityId: true,
        company: {
          select: {
            name: true,
            interactions: {
              orderBy: { occurredAt: "desc" },
              take: 1,
              select: { type: true, subject: true },
            },
          },
        },
        opportunity: { select: { title: true } },
      },
    }),
    prisma.quote.findMany({
      where: { status: { in: ["SENT", "VIEWED", "ACCEPTED"] } },
      orderBy: { updatedAt: "desc" },
      take: QUOTE_TAKE,
      select: {
        id: true,
        reference: true,
        status: true,
        amountIncTax: true,
        sentAt: true,
        acceptedAt: true,
        projectId: true,
        companyId: true,
        opportunityId: true,
        company: { select: { name: true } },
        opportunity: { select: { title: true } },
      },
    }),
    prisma.company.findMany({
      where: {
        lifecycleStatus: "LEAD",
        interactions: { none: {} },
        createdAt: { gte: fromParisDateTime(recent.year, recent.month, recent.day) },
      },
      orderBy: { createdAt: "desc" },
      take: PROSPECT_TAKE,
      select: { id: true, name: true, lifecycleStatus: true, createdAt: true },
    }),
    prisma.opportunity.findMany({
      where: { stage: { in: [...OPEN_OPPORTUNITY_STAGES] } },
      orderBy: { updatedAt: "asc" },
      take: OPPORTUNITY_TAKE,
      select: {
        id: true,
        title: true,
        stage: true,
        estimatedValue: true,
        updatedAt: true,
        companyId: true,
        company: { select: { name: true } },
        interactions: {
          orderBy: { occurredAt: "desc" },
          take: 1,
          select: { occurredAt: true },
        },
      },
    }),
    prisma.opportunity.groupBy({
      by: ["stage"],
      where: { stage: { in: [...OPEN_OPPORTUNITY_STAGES] } },
      _count: { _all: true },
      _sum: { estimatedValue: true },
    }),
    prisma.company.count({
      where: { lifecycleStatus: { in: [...PROSPECT_LIFECYCLES] } },
    }),
    prisma.followUp.count({
      where: { status: "PENDING", dueAt: { lt: dayStart } },
    }),
    prisma.followUp.count({
      where: { status: "PENDING", dueAt: { gte: dayStart, lte: dayEnd } },
    }),
    prisma.quote.count({
      where: { status: { in: ["SENT", "VIEWED"] } },
    }),
  ]);

  const followUpRows: OperationsFollowUp[] = followUps.map((followUp) => ({
    id: followUp.id,
    title: followUp.title,
    dueAt: followUp.dueAt.toISOString(),
    status: followUp.status,
    companyId: followUp.companyId,
    companyName: followUp.company.name,
    opportunityId: followUp.opportunityId,
    opportunityTitle: followUp.opportunity?.title ?? null,
    lastInteractionType: followUp.company.interactions[0]?.type ?? null,
    lastInteractionSubject: followUp.company.interactions[0]?.subject ?? null,
  }));

  const quoteRows: OperationsQuote[] = quotes.map((item) => ({
    id: item.id,
    reference: item.reference,
    status: item.status,
    amountIncTax: money(item.amountIncTax),
    sentAt: item.sentAt?.toISOString() ?? null,
    acceptedAt: item.acceptedAt?.toISOString() ?? null,
    projectId: item.projectId,
    companyId: item.companyId,
    companyName: item.company.name,
    opportunityId: item.opportunityId,
    opportunityTitle: item.opportunity.title,
  }));

  const opportunityRows: OperationsOpportunity[] = opportunities.map((item) => ({
    id: item.id,
    title: item.title,
    stage: item.stage,
    estimatedValue: money(item.estimatedValue),
    companyId: item.companyId,
    companyName: item.company.name,
    updatedAt: item.updatedAt.toISOString(),
    lastInteractionAt: item.interactions[0]?.occurredAt.toISOString() ?? null,
  }));

  return buildOperationsDashboard(
    {
      followUps: followUpRows,
      quotes: quoteRows,
      prospects: prospects.map((company) => ({
        id: company.id,
        name: company.name,
        lifecycleStatus: company.lifecycleStatus,
        createdAt: company.createdAt.toISOString(),
        interactionCount: 0,
      })),
      opportunities: opportunityRows,
      pipeline: pipeline.map((row) => ({
        stage: row.stage,
        count: row._count._all,
        estimatedValue: money(row._sum.estimatedValue),
      })),
      activeProspects,
      exact: {
        overdueFollowUps,
        todayFollowUps,
        waitingQuotes: waitingQuoteCount,
      },
    },
    now,
  );
}
