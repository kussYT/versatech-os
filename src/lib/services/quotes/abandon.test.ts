import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeFinanceTotals,
  neutralizeOpenPaymentsOnAbandonedQuotes,
} from "@/lib/finance";
import { abandonAcceptedQuoteSchema } from "@/lib/validations/quote";

/** Contrat callers : seuls les devis ACCEPTED alimentent le prévisionnel actif. */
const ACTIVE_FORECAST_QUOTE_STATUSES = ["ACCEPTED"] as const;
const CANCELABLE_ON_ABANDON = ["PENDING", "OVERDUE"] as const;

describe("abandonAcceptedQuoteSchema", () => {
  it("exige un motif d'au moins 10 caractères", () => {
    const short = abandonAcceptedQuoteSchema.safeParse({
      quoteId: "q1",
      reason: "court",
    });
    assert.equal(short.success, false);

    const ok = abandonAcceptedQuoteSchema.safeParse({
      quoteId: "q1",
      reason: "Le client a abandonné le projet, aucun encaissement prévu.",
    });
    assert.equal(ok.success, true);
  });
});

describe("clôture sans encaissement — règles métier", () => {
  const now = new Date("2026-10-11T12:00:00+02:00");

  it("le prévisionnel actif ne compte que ACCEPTED (ABANDONED exclu)", () => {
    assert.equal(ACTIVE_FORECAST_QUOTE_STATUSES.includes("ACCEPTED"), true);
    assert.equal(
      (ACTIVE_FORECAST_QUOTE_STATUSES as readonly string[]).includes("ABANDONED"),
      false,
    );

    const quotes = [
      { status: "ACCEPTED" as const, amount: "14500.00" },
      { status: "ABANDONED" as const, amount: "3200.00" },
    ];
    const active = quotes
      .filter((quote) =>
        (ACTIVE_FORECAST_QUOTE_STATUSES as readonly string[]).includes(quote.status),
      )
      .map((quote) => quote.amount);
    const totals = computeFinanceTotals(active, [], now);
    assert.equal(totals.signed, "14500.00");
    assert.equal(totals.signedUncollected, "14500.00");
  });

  it("abandon sans échéances : sort du prévisionnel, zéro à encaisser", () => {
    const abandonedIds = new Set(["q-abandon"]);
    const totals = computeFinanceTotals(
      [], // plus aucun ACCEPTED
      neutralizeOpenPaymentsOnAbandonedQuotes([], abandonedIds, now),
      now,
    );
    assert.equal(totals.signed, "0.00");
    assert.equal(totals.toCollect, "0.00");
    assert.equal(totals.overdue, "0.00");
    assert.equal(totals.collected, "0.00");
  });

  it("abandon avec échéances ouvertes : PENDING/OVERDUE hors KPI à encaisser", () => {
    assert.deepEqual([...CANCELABLE_ON_ABANDON], ["PENDING", "OVERDUE"]);

    const abandonedIds = new Set(["q-abandon"]);
    const payments = neutralizeOpenPaymentsOnAbandonedQuotes(
      [
        {
          amount: "1280.00",
          status: "PENDING",
          dueAt: new Date("2026-11-01T12:00:00+02:00"),
          quoteId: "q-abandon",
        },
        {
          amount: "1920.00",
          status: "OVERDUE",
          dueAt: new Date("2026-09-01T12:00:00+02:00"),
          quoteId: "q-abandon",
        },
      ],
      abandonedIds,
      now,
    );

    const totals = computeFinanceTotals([], payments, now);
    assert.equal(totals.toCollect, "0.00");
    assert.equal(totals.pending, "0.00");
    assert.equal(totals.overdue, "0.00");
    assert.equal(totals.scheduled, "0.00");
    assert.equal(totals.collected, "0.00");
  });

  it("conserve l'encaissé PAID et ne le décomptabilise pas après abandon", () => {
    assert.equal((CANCELABLE_ON_ABANDON as readonly string[]).includes("PAID"), false);

    const abandonedIds = new Set(["q-abandon"]);
    const payments = neutralizeOpenPaymentsOnAbandonedQuotes(
      [
        { amount: "1000.00", status: "PAID", quoteId: "q-abandon" },
        { amount: "2200.00", status: "PENDING", quoteId: "q-abandon" },
        { amount: "500.00", status: "CANCELED", quoteId: "q-abandon" },
      ],
      abandonedIds,
      now,
    );

    const totals = computeFinanceTotals([], payments, now);
    assert.equal(totals.collected, "1000.00");
    assert.equal(totals.toCollect, "0.00");
    assert.equal(totals.paidCount, 1);
    assert.equal(payments.find((payment) => payment.status === "PAID")?.amount, "1000.00");
  });

  it("n'impacte pas les échéances d'un autre devis encore ACCEPTED", () => {
    const abandonedIds = new Set(["q-abandon"]);
    const payments = neutralizeOpenPaymentsOnAbandonedQuotes(
      [
        { amount: "2200.00", status: "PENDING", quoteId: "q-abandon" },
        { amount: "8700.00", status: "PENDING", quoteId: "q-actif" },
      ],
      abandonedIds,
      now,
    );

    const totals = computeFinanceTotals(
      [{ id: "q-actif", amount: "14500.00" }],
      payments,
      now,
    );
    assert.equal(totals.signed, "14500.00");
    assert.equal(totals.toCollect, "8700.00");
    assert.equal(totals.pendingCount, 1);
  });
});
