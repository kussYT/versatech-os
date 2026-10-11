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

export type FinanceQuoteInput = {
  amount: string;
  /** Présent : seuls les paiements liés à ce devis ou à son projet réduisent le signé non encaissé. */
  id?: string;
  projectId?: string | null;
};

export type FinancePaymentLine = {
  amount: string;
  status: PaymentStatusValue;
  dueAt?: Date | string | null;
  quoteId?: string | null;
  projectId?: string | null;
};

export type FinanceTotals = {
  /** Somme des devis ACCEPTED actifs (prévisionnel). Les ABANDONED sont exclus par les callers. */
  signed: string;
  /** Paiements confirmés (PAID), chacun une fois. */
  collected: string;
  /**
   * Signé diminué des encaissements associés aux devis acceptés.
   * Ce n'est pas la somme des échéances impayées.
   */
  signedUncollected: string;
  /** Alias historique de `signedUncollected`. */
  remaining: string;
  /** Échéances non annulées (PAID + PENDING + OVERDUE). Ce n'est pas une facture. */
  scheduled: string;
  /** Échéances encore dues : PENDING + OVERDUE. */
  toCollect: string;
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

function asQuoteInput(quote: string | FinanceQuoteInput): FinanceQuoteInput {
  return typeof quote === "string" ? { amount: quote } : quote;
}

function paymentIsAssociated(payment: FinancePaymentLine, quotes: readonly FinanceQuoteInput[]) {
  const identified = quotes.some((quote) => quote.id);
  if (!identified) {
    return true;
  }

  if (payment.quoteId && quotes.some((quote) => quote.id === payment.quoteId)) {
    return true;
  }

  if (payment.projectId && quotes.some((quote) => quote.projectId && quote.projectId === payment.projectId)) {
    return true;
  }

  return false;
}

/**
 * Défense en profondeur : une échéance PENDING/OVERDUE rattachée à un devis ABANDONED
 * ne doit jamais alimenter « à encaisser » / « en retard ». Les PAID restent comptés.
 * L'abandon annule déjà ces échéances en base ; ce filtre couvre les écarts résiduels.
 */
export function neutralizeOpenPaymentsOnAbandonedQuotes(
  payments: readonly FinancePaymentLine[],
  abandonedQuoteIds: ReadonlySet<string>,
  now = new Date(),
): FinancePaymentLine[] {
  if (abandonedQuoteIds.size === 0) {
    return [...payments];
  }

  return payments.map((payment) => {
    if (!payment.quoteId || !abandonedQuoteIds.has(payment.quoteId)) {
      return payment;
    }
    const effective = effectivePaymentStatus(payment.status, payment.dueAt ?? null, now);
    if (effective === "PENDING" || effective === "OVERDUE") {
      return { ...payment, status: "CANCELED" };
    }
    return payment;
  });
}

export function computeFinanceTotals(
  acceptedQuotes: readonly (string | FinanceQuoteInput)[],
  payments: FinancePaymentLine[],
  now = new Date(),
): FinanceTotals {
  const quotes = acceptedQuotes.map(asQuoteInput);
  const signedCents = sumMoneyToCents(quotes.map((quote) => quote.amount));
  let collectedCents = BigInt(0);
  let associatedCollectedCents = BigInt(0);
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
      if (paymentIsAssociated(payment, quotes)) {
        associatedCollectedCents += cents;
      }
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

  const signedUncollectedCents = clampNonNegativeCents(signedCents - associatedCollectedCents);
  const toCollectCents = pendingCents + overdueCents;

  return {
    signed: centsToMoneyString(signedCents),
    collected: centsToMoneyString(collectedCents),
    signedUncollected: centsToMoneyString(signedUncollectedCents),
    remaining: centsToMoneyString(signedUncollectedCents),
    scheduled: centsToMoneyString(collectedCents + toCollectCents),
    toCollect: centsToMoneyString(toCollectCents),
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
