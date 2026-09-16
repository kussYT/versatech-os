import "server-only";

import type { AnalyticsSnapshot } from "@/lib/analytics/compute";
import { computeAnalytics } from "@/lib/analytics/compute";
import { prisma } from "@/lib/db/prisma";
import type { AnalyticsPeriod } from "@/lib/dates";

async function loadAnalyticsSnapshot(): Promise<AnalyticsSnapshot> {
  const [companies, interactions, opportunities, quotes, projects, payments, contracts] =
    await Promise.all([
      prisma.company.findMany({
        select: { createdAt: true, lifecycleStatus: true },
      }),
      prisma.interaction.findMany({
        select: { occurredAt: true, type: true },
      }),
      prisma.opportunity.findMany({
        select: {
          createdAt: true,
          stage: true,
          estimatedValue: true,
          probability: true,
          wonAt: true,
          lostAt: true,
        },
      }),
      prisma.quote.findMany({
        select: {
          sentAt: true,
          acceptedAt: true,
          updatedAt: true,
          status: true,
          amountIncTax: true,
        },
      }),
      prisma.project.findMany({
        select: { status: true, completedAt: true },
      }),
      prisma.payment.findMany({
        select: { amount: true, status: true, paidAt: true },
      }),
      prisma.maintenanceContract.findMany({
        select: { monthlyAmount: true, status: true, startDate: true, endDate: true },
      }),
    ]);

  return {
    companies,
    interactions,
    opportunities: opportunities.map((opportunity) => ({
      createdAt: opportunity.createdAt,
      stage: opportunity.stage,
      estimatedValue: opportunity.estimatedValue.toString(),
      probability: opportunity.probability,
      wonAt: opportunity.wonAt,
      lostAt: opportunity.lostAt,
    })),
    quotes: quotes.map((quote) => ({
      sentAt: quote.sentAt,
      acceptedAt: quote.acceptedAt,
      updatedAt: quote.updatedAt,
      status: quote.status,
      amountIncTax: quote.amountIncTax.toString(),
    })),
    projects,
    payments: payments.map((payment) => ({
      amount: payment.amount.toString(),
      status: payment.status,
      paidAt: payment.paidAt,
    })),
    contracts: contracts.map((contract) => ({
      monthlyAmount: contract.monthlyAmount.toString(),
      status: contract.status,
      startDate: contract.startDate,
      endDate: contract.endDate,
    })),
  };
}

export async function getAnalyticsReport(period: AnalyticsPeriod, now = new Date()) {
  const snapshot = await loadAnalyticsSnapshot();
  return computeAnalytics(snapshot, period, now);
}
