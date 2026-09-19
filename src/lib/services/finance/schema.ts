/**
 * Finance snapshot READ DTO — agrégats money.ts + MRR/ARR computeMrr.
 * READ only : aucune ligne de paiement, aucun externalReference, aucun champ d'écriture.
 */
import { z } from "zod";
import { tryParseMoneyToCents, ZERO_MONEY } from "@/lib/money";

const CANONICAL_MONEY_RE = /^-?\d+\.\d{2}$/;

export const moneyStringSchema = z.string().refine((value) => {
  if (!CANONICAL_MONEY_RE.test(value)) {
    return false;
  }
  return tryParseMoneyToCents(value) !== null;
}, 'Montant invalide (string money canonique, ex. "1234.56")');

const nonNegativeIntSchema = z.number().int().min(0);

export const getFinanceSnapshotInputSchema = z.strictObject({
  companyId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
});

export const financeSnapshotScopeSchema = z.strictObject({
  companyId: z.string().min(1).nullable(),
  projectId: z.string().min(1).nullable(),
});

/**
 * FinanceTotals + scope + MRR/ARR déjà calculés par computeMrr.
 * Interdit : payments[], externalReference, quoteId, paymentId, transitions.
 */
export const financeSnapshotSchema = z.strictObject({
  scope: financeSnapshotScopeSchema,
  signed: moneyStringSchema,
  collected: moneyStringSchema,
  remaining: moneyStringSchema,
  pending: moneyStringSchema,
  overdue: moneyStringSchema,
  pendingCount: nonNegativeIntSchema,
  overdueCount: nonNegativeIntSchema,
  paidCount: nonNegativeIntSchema,
  paymentCount: nonNegativeIntSchema,
  mrr: moneyStringSchema,
  arr: moneyStringSchema,
});

export type FinanceSnapshotDto = z.infer<typeof financeSnapshotSchema>;
export type GetFinanceSnapshotParsed = z.output<typeof getFinanceSnapshotInputSchema>;

/** Services throw this before any Prisma load. Never redirect. */
export function requireServiceActor(actor: { id?: string } | null | undefined) {
  if (!actor?.id) {
    throw new Error("Acteur requis.");
  }
}

export function emptyFinanceSnapshot(scope?: {
  companyId?: string | null;
  projectId?: string | null;
}): FinanceSnapshotDto {
  return parseFinanceSnapshot({
    scope: {
      companyId: scope?.companyId ?? null,
      projectId: scope?.projectId ?? null,
    },
    signed: ZERO_MONEY,
    collected: ZERO_MONEY,
    remaining: ZERO_MONEY,
    pending: ZERO_MONEY,
    overdue: ZERO_MONEY,
    pendingCount: 0,
    overdueCount: 0,
    paidCount: 0,
    paymentCount: 0,
    mrr: ZERO_MONEY,
    arr: ZERO_MONEY,
  });
}

export function parseGetFinanceSnapshotInput(input: unknown): GetFinanceSnapshotParsed {
  return getFinanceSnapshotInputSchema.parse(input);
}

export function parseFinanceSnapshot(input: unknown): FinanceSnapshotDto {
  return financeSnapshotSchema.parse(input);
}

export function serializeFinanceSnapshot(input: unknown): string {
  return JSON.stringify(parseFinanceSnapshot(input));
}

export function isPlainJsonValue(value: unknown): boolean {
  if (value === null) {
    return true;
  }

  const valueType = typeof value;
  if (valueType === "string" || valueType === "boolean") {
    return true;
  }
  if (valueType === "number") {
    return Number.isFinite(value);
  }
  if (valueType !== "object") {
    return false;
  }

  if (Array.isArray(value)) {
    return value.every(isPlainJsonValue);
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return false;
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    return false;
  }

  return Object.values(value as Record<string, unknown>).every(isPlainJsonValue);
}
