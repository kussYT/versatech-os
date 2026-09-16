import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { centsToMoneyString, parseMoneyToCents } from "./money";
import {
  computeFinanceTotals,
  effectivePaymentStatus,
  persistPaymentStatus,
  quotePaymentCapacity,
} from "./finance";

const PARIS_NOON = (isoDate: string) => new Date(`${isoDate}T12:00:00+02:00`);

describe("effectivePaymentStatus", () => {
  const now = PARIS_NOON("2026-09-16");

  it("laisse PAID et CANCELED inchangés même si l'échéance est passée", () => {
    assert.equal(effectivePaymentStatus("PAID", PARIS_NOON("2026-01-01"), now), "PAID");
    assert.equal(effectivePaymentStatus("CANCELED", PARIS_NOON("2026-01-01"), now), "CANCELED");
  });

  it("passe PENDING → OVERDUE quand dueAt est avant aujourd'hui (Europe/Paris)", () => {
    assert.equal(effectivePaymentStatus("PENDING", PARIS_NOON("2026-09-15"), now), "OVERDUE");
    assert.equal(effectivePaymentStatus("PENDING", PARIS_NOON("2026-09-16"), now), "PENDING");
    assert.equal(effectivePaymentStatus("PENDING", PARIS_NOON("2026-09-17"), now), "PENDING");
    assert.equal(effectivePaymentStatus("PENDING", null, now), "PENDING");
  });

  it("persiste OVERDUE à l'écriture si l'échéance est déjà dépassée", () => {
    assert.equal(persistPaymentStatus("PENDING", PARIS_NOON("2026-09-01"), now), "OVERDUE");
    assert.equal(persistPaymentStatus("PENDING", PARIS_NOON("2026-09-20"), now), "PENDING");
    assert.equal(persistPaymentStatus("PAID", PARIS_NOON("2026-09-01"), now), "PAID");
  });
});

describe("computeFinanceTotals", () => {
  const now = PARIS_NOON("2026-09-16");

  it("CA signé = somme des devis ACCEPTED uniquement", () => {
    const totals = computeFinanceTotals(["14500.00", "3200.50"], [], now);
    assert.equal(totals.signed, "17700.50");
    assert.equal(totals.collected, "0.00");
    assert.equal(totals.remaining, "17700.50");
  });

  it("ignore les devis non acceptés (ils n'entrent pas dans acceptedQuoteAmounts)", () => {
    const totals = computeFinanceTotals(["14500.00"], [], now);
    assert.equal(totals.signed, "14500.00");
  });

  it("CA encaissé = paiements PAID ; restant = max(0, signé − encaissé)", () => {
    const totals = computeFinanceTotals(
      ["14500.00"],
      [
        { amount: "5800.00", status: "PAID", dueAt: PARIS_NOON("2026-08-01") },
        { amount: "8700.00", status: "PENDING", dueAt: PARIS_NOON("2026-10-11") },
      ],
      now,
    );

    assert.equal(totals.signed, "14500.00");
    assert.equal(totals.collected, "5800.00");
    assert.equal(totals.remaining, "8700.00");
    assert.equal(totals.pending, "8700.00");
    assert.equal(totals.overdue, "0.00");
    assert.equal(totals.pendingCount, 1);
    assert.equal(totals.overdueCount, 0);
    assert.equal(totals.paidCount, 1);
  });

  it("paiements en retard = OVERDUE stocké + PENDING échu", () => {
    const totals = computeFinanceTotals(
      ["10000.00"],
      [
        { amount: "2000.00", status: "OVERDUE", dueAt: PARIS_NOON("2026-08-01") },
        { amount: "1500.50", status: "PENDING", dueAt: PARIS_NOON("2026-09-01") },
        { amount: "3000.00", status: "PENDING", dueAt: PARIS_NOON("2026-10-01") },
        { amount: "400.00", status: "CANCELED", dueAt: PARIS_NOON("2026-08-01") },
        { amount: "2500.00", status: "PAID", dueAt: PARIS_NOON("2026-07-01") },
      ],
      now,
    );

    assert.equal(totals.collected, "2500.00");
    assert.equal(totals.pending, "3000.00");
    assert.equal(totals.overdue, "3500.50");
    assert.equal(totals.remaining, "7500.00");
    assert.equal(totals.pendingCount, 1);
    assert.equal(totals.overdueCount, 2);
    assert.equal(totals.paidCount, 1);
  });

  it("ne laisse pas le restant négatif si l'encaissé dépasse le CA signé", () => {
    const totals = computeFinanceTotals(
      ["100.00"],
      [{ amount: "150.00", status: "PAID" }],
      now,
    );
    assert.equal(totals.remaining, "0.00");
    assert.equal(totals.collected, "150.00");
  });

  it("reste cohérent avec l'acompte + solde du seed Maison Rivage", () => {
    const totals = computeFinanceTotals(
      ["14500.00"],
      [
        { amount: "5800.00", status: "PAID", dueAt: PARIS_NOON("2026-08-12") },
        { amount: "8700.00", status: "PENDING", dueAt: PARIS_NOON("2026-10-11") },
      ],
      now,
    );

    assert.equal(totals.signed, "14500.00");
    assert.equal(totals.collected, "5800.00");
    assert.equal(totals.remaining, "8700.00");
    assert.equal(
      centsToMoneyString(parseMoneyToCents(totals.collected) + parseMoneyToCents(totals.remaining)),
      totals.signed,
    );
  });
});

describe("quotePaymentCapacity", () => {
  it("accepte acompte 1280 puis solde 1920 sur un devis 3200", () => {
    const afterDeposit = quotePaymentCapacity("3200.00", [], "1280.00");
    assert.equal(afterDeposit.exceeds, false);
    assert.equal(afterDeposit.remaining, "3200.00");

    const afterBalance = quotePaymentCapacity(
      "3200.00",
      [{ amount: "1280.00", status: "PAID" }],
      "1920.00",
    );
    assert.equal(afterBalance.exceeds, false);
    assert.equal(afterBalance.remaining, "1920.00");
  });

  it("refuse un paiement supplémentaire > 0 une fois le devis soldé", () => {
    const extra = quotePaymentCapacity(
      "3200.00",
      [
        { amount: "1280.00", status: "PAID" },
        { amount: "1920.00", status: "PAID" },
      ],
      "0.01",
    );
    assert.equal(extra.exceeds, true);
    assert.equal(extra.remaining, "0.00");
  });

  it("refuse un dépassement direct", () => {
    const overflow = quotePaymentCapacity("3200.00", [], "3200.01");
    assert.equal(overflow.exceeds, true);
  });

  it("compte PENDING et OVERDUE comme déjà engagés, ignore CANCELED", () => {
    const capacity = quotePaymentCapacity(
      "3200.00",
      [
        { amount: "1280.00", status: "PENDING" },
        { amount: "100.00", status: "CANCELED" },
      ],
      "1920.01",
    );
    assert.equal(capacity.exceeds, true);
    assert.equal(capacity.remaining, "1920.00");
  });
});
