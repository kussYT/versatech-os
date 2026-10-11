/**
 * Insight du jour — pur, déterministe, sans I/O.
 * Il ne lit que des comptages déjà calculés côté serveur : aucune donnée inventée.
 */

import { parisParts } from "@/lib/dates";

export type DailyInsightInput = {
  overdueFollowUps: number;
  todayFollowUps: number;
  /** Ancienneté (jours civils Paris) du plus ancien devis SENT|VIEWED envoyé ; null si aucun. */
  waitingQuotesOldestDays: number | null;
  /** Rendez-vous réels du jour (hors visites terrain). */
  todayAgendaCount: number;
  priorityActionCount: number;
  waitingQuotesCount: number;
};

export type DailyInsightTone = "urgent" | "attention" | "calm" | "neutral";

export type DailyInsight = {
  message: string;
  tone: DailyInsightTone;
};

/** Seuil (jours) à partir duquel un devis en attente devient une alerte. */
export const WAITING_QUOTE_ALERT_DAYS = 7;

/** Jours civils Europe/Paris écoulés entre `value` et `now` (0 = même jour, jamais négatif). */
export function civilDaysSinceParis(value: Date | string, now: Date): number {
  const index = (date: Date | string) => {
    const parts = parisParts(date);
    return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / 86_400_000);
  };
  return Math.max(0, index(now) - index(value));
}

function plural(count: number, singular: string, pluralForm: string) {
  return count === 1 ? singular : pluralForm;
}

export function buildDailyInsight(input: DailyInsightInput): DailyInsight {
  const {
    overdueFollowUps,
    todayFollowUps,
    waitingQuotesOldestDays,
    todayAgendaCount,
    priorityActionCount,
    waitingQuotesCount,
  } = input;

  if (overdueFollowUps > 0) {
    return {
      message: `Tu as ${overdueFollowUps} ${plural(overdueFollowUps, "relance", "relances")} en retard.`,
      tone: "urgent",
    };
  }

  if (todayFollowUps > 0) {
    return {
      message: `Tu as ${todayFollowUps} ${plural(
        todayFollowUps,
        "relance prioritaire",
        "relances prioritaires",
      )} aujourd'hui.`,
      tone: "attention",
    };
  }

  if (waitingQuotesOldestDays != null && waitingQuotesOldestDays >= WAITING_QUOTE_ALERT_DAYS) {
    return {
      message: `Un devis attend une réponse depuis ${waitingQuotesOldestDays} jours.`,
      tone: "attention",
    };
  }

  if (todayAgendaCount === 0) {
    return { message: "Aucun rendez-vous prévu aujourd'hui.", tone: "neutral" };
  }

  if (priorityActionCount > 0) {
    return {
      message: `${priorityActionCount} ${plural(
        priorityActionCount,
        "action prioritaire",
        "actions prioritaires",
      )} à traiter.`,
      tone: "attention",
    };
  }

  if (waitingQuotesCount > 0) {
    return {
      message: `${waitingQuotesCount} devis en attente de réponse.`,
      tone: "neutral",
    };
  }

  return { message: "Belle journée — rien d'urgent pour le moment.", tone: "calm" };
}
