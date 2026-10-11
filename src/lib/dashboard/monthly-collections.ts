import { parisParts } from "@/lib/dates";
import { centsToMoneyString, parseMoneyToCents } from "@/lib/money";

/** Encaissements par mois civil Europe/Paris. Montants en bigint cents, jamais en Number. */
export type MonthlyCollectionPoint = {
  /** 1-12 */
  month: number;
  label: string;
  /** Montant décimal (ex. "1200.50"). */
  amount: string;
  cents: bigint;
};

export const MONTH_SHORT_LABELS_FR = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
] as const;

export type MonthlyCollectionPaymentInput = {
  amount: string;
  paidAt: Date | string;
};

/**
 * Somme les paiements déjà filtrés PAID par mois civil Paris de `paidAt`,
 * pour l'année civile Paris `year`. Les 12 mois sont toujours présents.
 * Les paiements hors année sont ignorés ; un `paidAt` illisible est ignoré (jamais inventé).
 */
export function buildMonthlyCollectionSeries(
  payments: readonly MonthlyCollectionPaymentInput[],
  year: number,
): MonthlyCollectionPoint[] {
  const totals: bigint[] = Array.from({ length: 12 }, () => BigInt(0));

  for (const payment of payments) {
    const paidAt = payment.paidAt instanceof Date ? payment.paidAt : new Date(payment.paidAt);
    if (Number.isNaN(paidAt.getTime())) {
      continue;
    }

    const parts = parisParts(paidAt);
    if (parts.year !== year) {
      continue;
    }

    totals[parts.month - 1] += parseMoneyToCents(payment.amount);
  }

  return totals.map((cents, index) => ({
    month: index + 1,
    label: MONTH_SHORT_LABELS_FR[index]!,
    amount: centsToMoneyString(cents),
    cents,
  }));
}
