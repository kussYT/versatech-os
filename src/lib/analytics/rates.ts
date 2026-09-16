/** Taux d'effectif (pas un montant) : une décimale, null si dénominateur vide. */
export function ratePercent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) {
    return null;
  }

  return Math.round((numerator * 1000) / denominator) / 10;
}

export function formatRate(value: number | null) {
  if (value == null) {
    return "—";
  }

  return `${value.toLocaleString("fr-FR", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
    maximumFractionDigits: 1,
  })} %`;
}
