import type { OpportunityStage } from "@/generated/prisma/client";

/** Probabilité par stage, en pourcentage entier 0–100 (schéma `Opportunity.probability`). */
export const STAGE_PROBABILITY: Record<OpportunityStage, number> = {
  TO_QUALIFY: 10,
  TO_CONTACT: 20,
  CONTACTED: 30,
  INTERESTED: 45,
  MEETING: 55,
  QUOTE: 70,
  WON: 100,
  LOST: 0,
};

export function clampProbability(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}

export function probabilityFromStage(stage: OpportunityStage) {
  return STAGE_PROBABILITY[stage];
}

/**
 * Valeur persistée à l'écriture.
 * Une saisie manuelle (0–100) prime ; sinon le mapping de stage.
 */
export function probabilityForWrite(
  stage: OpportunityStage,
  override?: number | null,
) {
  if (override == null) {
    return probabilityFromStage(stage);
  }

  return clampProbability(override);
}

/**
 * Lecture KPI / UI : un 0 sur un stage ouvert est traité comme « non renseigné »
 * et retombe sur le mapping. LOST reste 0. Une valeur 1–100 est conservée.
 */
export function effectiveProbability(stage: OpportunityStage, stored: number) {
  if (stage === "LOST") {
    return 0;
  }

  if (stored > 0) {
    return clampProbability(stored);
  }

  return probabilityFromStage(stage);
}

/** BR-017 : valeur × probabilité (0–100 → ratio). */
export function weightedValue(estimatedValue: number, probabilityPercent: number) {
  if (!Number.isFinite(estimatedValue) || estimatedValue <= 0) {
    return 0;
  }

  return (estimatedValue * clampProbability(probabilityPercent)) / 100;
}
