import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { fromParisDateTime } from "@/lib/dates";
import {
  buildDailyInsight,
  civilDaysSinceParis,
  type DailyInsightInput,
} from "@/lib/dashboard/insight";

describe("civilDaysSinceParis", () => {
  test("compte des jours civils Paris, pas des tranches de 24 h", () => {
    const now = fromParisDateTime(2026, 10, 11, 0, 5);
    assert.equal(civilDaysSinceParis(fromParisDateTime(2026, 10, 10, 23, 55), now), 1);
    assert.equal(civilDaysSinceParis(fromParisDateTime(2026, 10, 11, 0, 1), now), 0);
    assert.equal(civilDaysSinceParis(fromParisDateTime(2026, 10, 4, 18, 0), now), 7);
  });

  test("traverse le changement d'heure sans décalage", () => {
    const now = fromParisDateTime(2026, 10, 27, 12);
    assert.equal(civilDaysSinceParis(fromParisDateTime(2026, 10, 20, 12), now), 7);
  });

  test("une date future vaut 0", () => {
    const now = fromParisDateTime(2026, 10, 11, 12);
    assert.equal(civilDaysSinceParis(fromParisDateTime(2026, 10, 15, 12), now), 0);
  });
});

const QUIET: DailyInsightInput = {
  overdueFollowUps: 0,
  todayFollowUps: 0,
  waitingQuotesOldestDays: null,
  todayAgendaCount: 1,
  priorityActionCount: 0,
  waitingQuotesCount: 0,
};

function insight(overrides: Partial<DailyInsightInput>) {
  return buildDailyInsight({ ...QUIET, ...overrides });
}

describe("buildDailyInsight", () => {
  test("relances en retard : urgent, singulier et pluriel", () => {
    assert.deepEqual(insight({ overdueFollowUps: 1 }), {
      message: "Tu as 1 relance en retard.",
      tone: "urgent",
    });
    assert.deepEqual(insight({ overdueFollowUps: 3 }), {
      message: "Tu as 3 relances en retard.",
      tone: "urgent",
    });
  });

  test("relances du jour : attention", () => {
    assert.deepEqual(insight({ todayFollowUps: 1 }), {
      message: "Tu as 1 relance prioritaire aujourd'hui.",
      tone: "attention",
    });
    assert.deepEqual(insight({ todayFollowUps: 4 }), {
      message: "Tu as 4 relances prioritaires aujourd'hui.",
      tone: "attention",
    });
  });

  test("devis en attente depuis 7 jours ou plus : attention", () => {
    assert.deepEqual(insight({ waitingQuotesOldestDays: 7, waitingQuotesCount: 1 }), {
      message: "Un devis attend une réponse depuis 7 jours.",
      tone: "attention",
    });
    assert.equal(
      insight({ waitingQuotesOldestDays: 12, waitingQuotesCount: 2 }).message,
      "Un devis attend une réponse depuis 12 jours.",
    );
  });

  test("devis de 6 jours : pas d'alerte d'ancienneté", () => {
    const result = insight({ waitingQuotesOldestDays: 6, waitingQuotesCount: 1 });
    assert.equal(result.message, "1 devis en attente de réponse.");
    assert.equal(result.tone, "neutral");
  });

  test("aucun rendez-vous aujourd'hui : neutral", () => {
    assert.deepEqual(insight({ todayAgendaCount: 0 }), {
      message: "Aucun rendez-vous prévu aujourd'hui.",
      tone: "neutral",
    });
  });

  test("actions prioritaires : attention", () => {
    assert.deepEqual(insight({ priorityActionCount: 1 }), {
      message: "1 action prioritaire à traiter.",
      tone: "attention",
    });
    assert.deepEqual(insight({ priorityActionCount: 5 }), {
      message: "5 actions prioritaires à traiter.",
      tone: "attention",
    });
  });

  test("devis en attente : neutral", () => {
    assert.deepEqual(insight({ waitingQuotesCount: 3, waitingQuotesOldestDays: 2 }), {
      message: "3 devis en attente de réponse.",
      tone: "neutral",
    });
  });

  test("rien d'urgent : calm", () => {
    assert.deepEqual(insight({}), {
      message: "Belle journée — rien d'urgent pour le moment.",
      tone: "calm",
    });
  });

  test("première règle gagnante : retard avant tout le reste", () => {
    const result = insight({
      overdueFollowUps: 2,
      todayFollowUps: 3,
      waitingQuotesOldestDays: 30,
      todayAgendaCount: 0,
      priorityActionCount: 9,
      waitingQuotesCount: 4,
    });
    assert.equal(result.message, "Tu as 2 relances en retard.");
    assert.equal(result.tone, "urgent");
  });

  test("relances du jour passent avant les devis anciens", () => {
    const result = insight({ todayFollowUps: 1, waitingQuotesOldestDays: 20, todayAgendaCount: 0 });
    assert.equal(result.message, "Tu as 1 relance prioritaire aujourd'hui.");
  });

  test("devis ancien passe avant l'agenda vide", () => {
    const result = insight({ waitingQuotesOldestDays: 8, todayAgendaCount: 0 });
    assert.equal(result.message, "Un devis attend une réponse depuis 8 jours.");
  });

  test("agenda vide passe avant les actions prioritaires", () => {
    const result = insight({ todayAgendaCount: 0, priorityActionCount: 3, waitingQuotesCount: 2 });
    assert.equal(result.message, "Aucun rendez-vous prévu aujourd'hui.");
  });

  test("actions prioritaires passent avant les devis en attente", () => {
    const result = insight({ priorityActionCount: 2, waitingQuotesCount: 2 });
    assert.equal(result.message, "2 actions prioritaires à traiter.");
  });
});
