import "server-only";

import { requireAuthenticatedUser } from "@/lib/auth/dal";

import type { PaymentStatus, QuoteStatus } from "@/generated/prisma/client";
import { computeFinanceTotals, effectivePaymentStatus, type FinanceTotals } from "@/lib/finance";
import { centsToMoneyString, parseMoneyToCents } from "@/lib/money";
import { prisma } from "@/lib/db/prisma";

export type PaymentListItem = {
  id: string;
  label: string;
  amount: string;
  status: PaymentStatus;
  effectiveStatus: PaymentStatus;
  dueAt: string | null;
  paidAt: string | null;
  externalReference: string | null;
  createdAt: string;
  company: {
    id: string;
    name: string;
  };
  quote: {
    id: string;
    reference: string;
    status: QuoteStatus;
  } | null;
  project: {
    id: string;
    name: string;
  } | null;
};

export type PaymentQuoteOption = {
  id: string;
  reference: string;
  companyId: string;
  projectId: string | null;
  status: QuoteStatus;
  amountIncTax: string;
  collected: string;
  remaining: string;
};

export type PaymentProjectOption = {
  id: string;
  name: string;
  companyId: string;
};

export type PaymentCompanyOption = {
  id: string;
  name: string;
};

export type PaymentFormOptions = {
  companies: PaymentCompanyOption[];
  quotes: PaymentQuoteOption[];
  projects: PaymentProjectOption[];
};

export type FinanceScope = {
  companyId?: string;
  projectId?: string;
};

const paymentListInclude = {
  company: { select: { id: true, name: true } },
  quote: { select: { id: true, reference: true, status: true } },
  project: { select: { id: true, name: true } },
} as const;

function toPaymentListItem(
  payment: {
    id: string;
    label: string;
    amount: { toString(): string };
    status: PaymentStatus;
    dueAt: Date | null;
    paidAt: Date | null;
    externalReference: string | null;
    createdAt: Date;
    company: { id: string; name: string };
    quote: { id: string; reference: string; status: QuoteStatus } | null;
    project: { id: string; name: string } | null;
  },
  now = new Date(),
): PaymentListItem {
  return {
    id: payment.id,
    label: payment.label,
    amount: payment.amount.toString(),
    status: payment.status,
    effectiveStatus: effectivePaymentStatus(payment.status, payment.dueAt, now),
    dueAt: payment.dueAt?.toISOString() ?? null,
    paidAt: payment.paidAt?.toISOString() ?? null,
    externalReference: payment.externalReference,
    createdAt: payment.createdAt.toISOString(),
    company: payment.company,
    quote: payment.quote,
    project: payment.project,
  };
}

function quoteWhere(scope: FinanceScope) {
  return {
    status: "ACCEPTED" as const,
    ...(scope.companyId ? { companyId: scope.companyId } : {}),
    ...(scope.projectId ? { projectId: scope.projectId } : {}),
  };
}

function paymentWhere(scope: FinanceScope) {
  return {
    ...(scope.companyId ? { companyId: scope.companyId } : {}),
    ...(scope.projectId ? { projectId: scope.projectId } : {}),
  };
}

/** Caller must authenticate. READ aggregates via computeFinanceTotals (money strings). */
export async function loadFinanceSnapshot(scope: FinanceScope = {}, now = new Date()) {
  const [quotes, payments] = await Promise.all([
    prisma.quote.findMany({
      where: quoteWhere(scope),
      select: { amountIncTax: true },
    }),
    prisma.payment.findMany({
      where: paymentWhere(scope),
      select: { amount: true, status: true, dueAt: true },
    }),
  ]);

  return computeFinanceTotals(
    quotes.map((quote) => quote.amountIncTax.toString()),
    payments.map((payment) => ({
      amount: payment.amount.toString(),
      status: payment.status,
      dueAt: payment.dueAt,
    })),
    now,
  );
}

export async function getFinanceSnapshot(scope: FinanceScope = {}, now = new Date()) {
  await requireAuthenticatedUser();
  return loadFinanceSnapshot(scope, now);
}

export async function listPayments(scope: FinanceScope = {}, now = new Date()): Promise<PaymentListItem[]> {
  await requireAuthenticatedUser();
  const payments = await prisma.payment.findMany({
    where: paymentWhere(scope),
    orderBy: [{ createdAt: "desc" }, { label: "asc" }],
    include: paymentListInclude,
  });

  return payments.map((payment) => toPaymentListItem(payment, now));
}

export async function listPaymentFormOptions(scope: FinanceScope = {}): Promise<PaymentFormOptions> {
  await requireAuthenticatedUser();
  const [companies, quotes, projects, paidByQuote] = await Promise.all([
    prisma.company.findMany({
      where: scope.companyId ? { id: scope.companyId } : undefined,
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.quote.findMany({
      where: {
        status: "ACCEPTED",
        ...(scope.companyId ? { companyId: scope.companyId } : {}),
        ...(scope.projectId ? { projectId: scope.projectId } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { reference: "asc" }],
      select: {
        id: true,
        reference: true,
        companyId: true,
        projectId: true,
        status: true,
        amountIncTax: true,
      },
    }),
    prisma.project.findMany({
      where: {
        ...(scope.companyId ? { companyId: scope.companyId } : {}),
        ...(scope.projectId ? { id: scope.projectId } : {}),
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, companyId: true },
    }),
    prisma.payment.groupBy({
      by: ["quoteId"],
      where: {
        status: { not: "CANCELED" },
        quoteId: { not: null },
        ...(scope.companyId ? { companyId: scope.companyId } : {}),
        ...(scope.projectId ? { projectId: scope.projectId } : {}),
      },
      _sum: { amount: true },
    }),
  ]);

  const collectedByQuote = new Map(
    paidByQuote
      .filter((row) => row.quoteId)
      .map((row) => [row.quoteId as string, row._sum.amount?.toString() ?? "0.00"]),
  );

  return {
    companies,
    quotes: quotes.map((quote) => {
      const amount = quote.amountIncTax.toString();
      const collected = collectedByQuote.get(quote.id) ?? "0.00";
      const remainingCents = parseMoneyToCents(amount) - parseMoneyToCents(collected);
      return {
        id: quote.id,
        reference: quote.reference,
        companyId: quote.companyId,
        projectId: quote.projectId,
        status: quote.status,
        amountIncTax: amount,
        collected,
        remaining: centsToMoneyString(remainingCents < BigInt(0) ? BigInt(0) : remainingCents),
      };
    }),
    projects,
  };
}

export type { FinanceTotals };
