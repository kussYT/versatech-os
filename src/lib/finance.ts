import type { PaymentStatus } from "@/generated/prisma/client";
import { dueBucket } from "@/lib/dates";
import {
  centsToMoneyString,
  clampNonNegativeCents,
  parseMoneyToCents,
  sumMoneyToCents,
} from "@/lib/money";

export const PAYMENT_STATUSES = ["PENDING", "PAID", "OVERDUE", "CANCELED"] as const satisfies readonly PaymentStatus[];
export type PaymentStatusValue = (typeof PAYMENT_STATUSES)[number];

const ENGAGED_PAYMENT_STATUSES = new Set<PaymentStatusValue>(["PENDING", "PAID", "OVERDUE"]);

export const CREATE_PAYMENT_STATUSES = ["PENDING", "PAID"] as const;
export type CreatePaymentStatus = (typeof CREATE_PAYMENT_STATUSES)[number];

export type FinancePaymentLine = {
  amount: string;
  status: PaymentStatusValue;
  dueAt?: Date | string | null;
};

export type FinanceTotals = {
  signed: string;
  collected: string;
  remaining: string;
  pending: string;
  overdue: string;
  pendingCount: number;
  overdueCount: number;
  paidCount: number;
  paymentCount: number;
};

export function effectivePaymentStatus(
  status: PaymentStatusValue,
  dueAt: Date | string | null | undefined,
  now = new Date(),
): PaymentStatusValue {
  if (status !== "PENDING") {
    return status;
  }

  if (!dueAt) {
    return "PENDING";
  }

  const due = dueAt instanceof Date ? dueAt : new Date(dueAt);
  if (Number.isNaN(due.getTime())) {
    return "PENDING";
  }

  return dueBucket(due, now) === "overdue" ? "OVERDUE" : "PENDING";
}

export function persistPaymentStatus(
  requested: CreatePaymentStatus | PaymentStatusValue,
  dueAt: Date | null,
  now = new Date(),
): PaymentStatusValue {
  if (requested === "PENDING") {
    return effectivePaymentStatus("PENDING", dueAt, now);
  }

  return requested;
}

export function computeFinanceTotals(
  acceptedQuoteAmounts: string[],
  payments: FinancePaymentLine[],
  now = new Date(),
): FinanceTotals {
  const signedCents = sumMoneyToCents(acceptedQuoteAmounts);
  let collectedCents = BigInt(0);
  let pendingCents = BigInt(0);
  let overdueCents = BigInt(0);
  let pendingCount = 0;
  let overdueCount = 0;
  let paidCount = 0;

  for (const payment of payments) {
    const effective = effectivePaymentStatus(payment.status, payment.dueAt ?? null, now);
    const cents = parseMoneyToCents(payment.amount);

    if (effective === "PAID") {
      collectedCents += cents;
      paidCount += 1;
      continue;
    }

    if (effective === "PENDING") {
      pendingCents += cents;
      pendingCount += 1;
      continue;
    }

    if (effective === "OVERDUE") {
      overdueCents += cents;
      overdueCount += 1;
    }
  }

  return {
    signed: centsToMoneyString(signedCents),
    collected: centsToMoneyString(collectedCents),
    remaining: centsToMoneyString(clampNonNegativeCents(signedCents - collectedCents)),
    pending: centsToMoneyString(pendingCents),
    overdue: centsToMoneyString(overdueCents),
    pendingCount,
    overdueCount,
    paidCount,
    paymentCount: payments.length,
  };
}

export function isEngagedPaymentStatus(status: PaymentStatusValue) {
  return ENGAGED_PAYMENT_STATUSES.has(status);
}

/**
 * Capacité restante d'un devis accepté : TTC − paiements non annulés (PAID + PENDING + OVERDUE).
 * Un nouveau paiement rattaché au devis ne peut pas dépasser ce plafond.
 */
export function quotePaymentCapacity(
  quoteAmountIncTax: string,
  existingPayments: readonly { amount: string; status: PaymentStatusValue }[],
  incomingAmount: string,
) {
  const quoteCents = parseMoneyToCents(quoteAmountIncTax);
  let engagedCents = BigInt(0);
  for (const payment of existingPayments) {
    if (isEngagedPaymentStatus(payment.status)) {
      engagedCents += parseMoneyToCents(payment.amount);
    }
  }

  const incomingCents = parseMoneyToCents(incomingAmount);
  const remainingCents = clampNonNegativeCents(quoteCents - engagedCents);

  return {
    quoteCents,
    engagedCents,
    incomingCents,
    remainingCents,
    remaining: centsToMoneyString(remainingCents),
    exceeds: engagedCents + incomingCents > quoteCents,
  };
}

export const PAYMENT_STATUS_TRANSITIONS: Record<PaymentStatusValue, PaymentStatusValue[]> = {
  PENDING: ["PAID", "OVERDUE", "CANCELED"],
  OVERDUE: ["PAID", "CANCELED"],
  PAID: [],
  CANCELED: [],
};
