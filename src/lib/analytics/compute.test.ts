import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeAnalytics, type AnalyticsSnapshot } from "./compute";
import { fromParisDateTime } from "../dates";

const now = fromParisDateTime(2026, 9, 16, 15, 0, 0, 0);

function emptySnapshot(overrides: Partial<AnalyticsSnapshot> = {}): AnalyticsSnapshot {
  return {
    companies: [],
    interactions: [],
    opportunities: [],
    quotes: [],
    projects: [],
    payments: [],
    contracts: [],
    ...overrides,
  };
}

describe("computeAnalytics périodes", () => {
  it("exclut un événement hors des 30 jours civils Paris", () => {
    const inside = fromParisDateTime(2026, 8, 18, 9, 0, 0, 0);
    const outside = fromParisDateTime(2026, 8, 17, 23, 0, 0, 0);

    const report = computeAnalytics(
      emptySnapshot({
        companies: [
          { createdAt: inside, lifecycleStatus: "LEAD" },
          { createdAt: outside, lifecycleStatus: "LEAD" },
        ],
        interactions: [
          { occurredAt: inside, type: "CALL" },
          { occurredAt: outside, type: "CALL" },
        ],
      }),
      "30d",
      now,
    );

    assert.equal(report.commercial.prospectsCreated, 1);
    assert.equal(report.commercial.calls, 1);
    assert.equal(report.commercial.contactsMade, 1);
  });

  it("compte l'année civile Paris et ignore l'année précédente", () => {
    const inYear = fromParisDateTime(2026, 1, 1, 0, 0, 0, 0);
    const previousYear = fromParisDateTime(2025, 12, 31, 23, 59, 0, 0);

    const report = computeAnalytics(
      emptySnapshot({
        companies: [
          { createdAt: inYear, lifecycleStatus: "LEAD" },
          { createdAt: previousYear, lifecycleStatus: "LEAD" },
        ],
      }),
      "year",
      now,
    );

    assert.equal(report.commercial.prospectsCreated, 1);
    assert.ok(report.range.start);
    assert.equal(report.range.start.toISOString(), "2025-12-31T23:00:00.000Z");
  });

  it("en global inclut tout l'historique", () => {
    const report = computeAnalytics(
      emptySnapshot({
        companies: [
          { createdAt: fromParisDateTime(2024, 3, 1, 10, 0, 0, 0), lifecycleStatus: "CLIENT" },
          { createdAt: fromParisDateTime(2026, 9, 1, 10, 0, 0, 0), lifecycleStatus: "LEAD" },
        ],
      }),
      "all",
      now,
    );

    assert.equal(report.commercial.prospectsCreated, 2);
    assert.equal(report.clients.clients, 1);
    assert.equal(report.range.start, null);
    assert.equal(report.range.end, null);
  });
});

describe("computeAnalytics commercial", () => {
  it("sépare appels, RDV et autres contacts", () => {
    const at = fromParisDateTime(2026, 9, 10, 11, 0, 0, 0);
    const report = computeAnalytics(
      emptySnapshot({
        interactions: [
          { occurredAt: at, type: "CALL" },
          { occurredAt: at, type: "CALL" },
          { occurredAt: at, type: "MEETING" },
          { occurredAt: at, type: "EMAIL" },
          { occurredAt: at, type: "NOTE" },
        ],
      }),
      "30d",
      now,
    );

    assert.equal(report.commercial.calls, 2);
    assert.equal(report.commercial.meetings, 1);
    assert.equal(report.commercial.contactsMade, 4);
  });

  it("calcule le taux devis → accepté sur la cohorte envoyée", () => {
    const sent = fromParisDateTime(2026, 9, 1, 10, 0, 0, 0);
    const accepted = fromParisDateTime(2026, 9, 5, 10, 0, 0, 0);
    const report = computeAnalytics(
      emptySnapshot({
        quotes: [
          {
            sentAt: sent,
            acceptedAt: accepted,
            updatedAt: accepted,
            status: "ACCEPTED",
            amountIncTax: "1000.00",
          },
          {
            sentAt: sent,
            acceptedAt: null,
            updatedAt: sent,
            status: "SENT",
            amountIncTax: "2000.00",
          },
          {
            sentAt: sent,
            acceptedAt: null,
            updatedAt: sent,
            status: "REJECTED",
            amountIncTax: "500.00",
          },
          {
            sentAt: sent,
            acceptedAt: null,
            updatedAt: sent,
            status: "VIEWED",
            amountIncTax: "800.00",
          },
        ],
      }),
      "30d",
      now,
    );

    assert.equal(report.commercial.quotesSent, 4);
    assert.equal(report.commercial.quotesAccepted, 1);
    assert.equal(report.commercial.quotesRejected, 1);
    assert.equal(report.commercial.quoteAcceptedRate, 25);
    assert.equal(report.clients.averageAcceptedQuote, "1000.00");
    assert.equal(report.finance.signedRevenue, "1000.00");
  });

  it("calcule le taux prospect → client sur les créations de la période", () => {
    const created = fromParisDateTime(2026, 9, 2, 9, 0, 0, 0);
    const report = computeAnalytics(
      emptySnapshot({
        companies: [
          { createdAt: created, lifecycleStatus: "CLIENT" },
          { createdAt: created, lifecycleStatus: "LEAD" },
          { createdAt: created, lifecycleStatus: "QUALIFIED" },
          { createdAt: created, lifecycleStatus: "LOST" },
        ],
      }),
      "30d",
      now,
    );

    assert.equal(report.commercial.prospectsCreated, 4);
    assert.equal(report.commercial.prospectToClientRate, 25);
    assert.equal(report.clients.clients, 1);
  });
});

describe("computeAnalytics pipeline et finance", () => {
  it("calcule brut et pondéré uniquement sur les stages ouverts", () => {
    const created = fromParisDateTime(2026, 9, 1, 10, 0, 0, 0);
    const report = computeAnalytics(
      emptySnapshot({
        opportunities: [
          {
            createdAt: created,
            stage: "QUOTE",
            estimatedValue: "10000.00",
            probability: 70,
            wonAt: null,
            lostAt: null,
          },
          {
            createdAt: created,
            stage: "WON",
            estimatedValue: "14500.00",
            probability: 100,
            wonAt: created,
            lostAt: null,
          },
          {
            createdAt: created,
            stage: "LOST",
            estimatedValue: "3000.00",
            probability: 0,
            wonAt: null,
            lostAt: created,
          },
        ],
      }),
      "30d",
      now,
    );

    assert.equal(report.pipeline.openCount, 1);
    assert.equal(report.pipeline.brut, "10000.00");
    assert.equal(report.pipeline.weighted, "7000.00");
    assert.equal(report.pipeline.won, 1);
    assert.equal(report.pipeline.lost, 1);
  });

  it("applique le mapping de stage si la probabilité stockée est 0", () => {
    const created = fromParisDateTime(2026, 9, 1, 10, 0, 0, 0);
    const report = computeAnalytics(
      emptySnapshot({
        opportunities: [
          {
            createdAt: created,
            stage: "MEETING",
            estimatedValue: "9800.00",
            probability: 0,
            wonAt: null,
            lostAt: null,
          },
        ],
      }),
      "all",
      now,
    );

    assert.equal(report.pipeline.weighted, "5390.00");
  });

  it("agrège CA, encaissé, restant et MRR sans float", () => {
    const paidAt = fromParisDateTime(2026, 9, 1, 10, 0, 0, 0);
    const acceptedAt = fromParisDateTime(2026, 9, 2, 10, 0, 0, 0);
    const report = computeAnalytics(
      emptySnapshot({
        quotes: [
          {
            sentAt: fromParisDateTime(2026, 8, 20, 10, 0, 0, 0),
            acceptedAt,
            updatedAt: acceptedAt,
            status: "ACCEPTED",
            amountIncTax: "14500.00",
          },
        ],
        payments: [
          { amount: "5800.00", status: "PAID", paidAt },
          { amount: "8700.00", status: "PENDING", paidAt: null },
          { amount: "200.00", status: "OVERDUE", paidAt: null },
          { amount: "50.00", status: "CANCELED", paidAt: null },
        ],
        contracts: [
          {
            monthlyAmount: "89.00",
            status: "ACTIVE",
            startDate: fromParisDateTime(2026, 8, 1, 0, 0, 0, 0),
            endDate: null,
          },
          {
            monthlyAmount: "199.00",
            status: "ACTIVE",
            startDate: fromParisDateTime(2026, 10, 1, 0, 0, 0, 0),
            endDate: null,
          },
          {
            monthlyAmount: "49.00",
            status: "ENDED",
            startDate: fromParisDateTime(2026, 1, 1, 0, 0, 0, 0),
            endDate: fromParisDateTime(2026, 6, 1, 0, 0, 0, 0),
          },
        ],
        projects: [
          { status: "ACTIVE", completedAt: null },
          { status: "WAITING_CLIENT", completedAt: null },
          {
            status: "COMPLETED",
            completedAt: fromParisDateTime(2026, 9, 10, 12, 0, 0, 0),
          },
          {
            status: "COMPLETED",
            completedAt: fromParisDateTime(2025, 1, 10, 12, 0, 0, 0),
          },
        ],
      }),
      "90d",
      now,
    );

    assert.equal(report.finance.signedRevenue, "14500.00");
    assert.equal(report.finance.collected, "5800.00");
    assert.equal(report.finance.remaining, "8700.00");
    assert.equal(report.finance.expectedPayments, "8900.00");
    assert.equal(report.finance.mrr, "89.00");
    assert.equal(report.clients.activeProjects, 2);
    assert.equal(report.clients.completedProjects, 1);
  });
});
