/**
 * Montants financiers en centimes d'euro (bigint).
 * Jamais de Number/Float pour l'arithmétique : Decimal(12, 2) → string → cents.
 */

export type MoneyInput = string | { toString(): string };

const MONEY_RE = /^(-)?(\d+)(?:\.(\d{1,2}))?$/;
const ZERO = BigInt(0);
const HUNDRED = BigInt(100);

export const ZERO_MONEY = "0.00";

export function normalizeMoneyInput(value: MoneyInput) {
  return (typeof value === "string" ? value : value.toString()).trim().replace(",", ".");
}

export function parseMoneyToCents(value: MoneyInput): bigint {
  const normalized = normalizeMoneyInput(value);
  const match = MONEY_RE.exec(normalized);
  if (!match) {
    throw new Error(`Montant invalide: ${normalized}`);
  }

  const negative = match[1] === "-";
  const euros = BigInt(match[2]);
  const fraction = BigInt((match[3] ?? "").padEnd(2, "0"));
  const cents = euros * HUNDRED + fraction;
  return negative ? -cents : cents;
}

export function tryParseMoneyToCents(value: MoneyInput) {
  try {
    return parseMoneyToCents(value);
  } catch {
    return null;
  }
}

export function centsToMoneyString(cents: bigint): string {
  const negative = cents < ZERO;
  const abs = negative ? -cents : cents;
  const euros = abs / HUNDRED;
  const fraction = abs % HUNDRED;
  const body = `${euros.toString()}.${fraction.toString().padStart(2, "0")}`;
  return negative ? `-${body}` : body;
}

export function sumMoneyToCents(values: readonly MoneyInput[]) {
  let total = ZERO;
  for (const value of values) {
    total += parseMoneyToCents(value);
  }
  return total;
}

export function sumMoney(values: readonly MoneyInput[]) {
  return centsToMoneyString(sumMoneyToCents(values));
}

export function subtractMoney(left: MoneyInput, right: MoneyInput) {
  return centsToMoneyString(parseMoneyToCents(left) - parseMoneyToCents(right));
}

export function clampNonNegativeCents(cents: bigint) {
  return cents < ZERO ? ZERO : cents;
}

export function isPositiveMoneyString(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return false;
  }
  return parseMoneyToCents(normalized) > ZERO;
}

export function multiplyMoney(value: MoneyInput, factor: number): string {
  if (!Number.isInteger(factor)) {
    throw new Error("Le multiplicateur doit être un entier.");
  }

  return centsToMoneyString(parseMoneyToCents(value) * BigInt(factor));
}

export function normalizeMoney(value: MoneyInput) {
  return centsToMoneyString(parseMoneyToCents(value));
}

export function weightedMoney(amount: MoneyInput, probabilityPercent: number): string {
  if (!Number.isInteger(probabilityPercent)) {
    throw new Error("La probabilité doit être un entier.");
  }

  return centsToMoneyString(
    (parseMoneyToCents(amount) * BigInt(probabilityPercent)) / BigInt(100),
  );
}

export function averageMoney(total: MoneyInput, count: number): string | null {
  if (!Number.isInteger(count) || count <= 0) {
    return null;
  }

  return centsToMoneyString(parseMoneyToCents(total) / BigInt(count));
}

/** Alias Maintenance : parseCents / formatCents. */
export const parseCents = parseMoneyToCents;
export const formatCents = centsToMoneyString;

export function isPositiveMoney(value: string) {
  try {
    return parseMoneyToCents(value) > ZERO;
  } catch {
    return false;
  }
}
