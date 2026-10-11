import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { fromParisDateTime } from "@/lib/dates";
import {
  buildMonthlyCollectionSeries,
  MONTH_SHORT_LABELS_FR,
} from "@/lib/dashboard/monthly-collections";

describe("buildMonthlyCollectionSeries", () => {
  test("retourne 12 mois avec libellés FR courts, même sans paiement", () => {
    const series = buildMonthlyCollectionSeries([], 2026);
    assert.equal(series.length, 12);
    assert.deepEqual(
      series.map((point) => point.month),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    );
    assert.deepEqual(
      series.map((point) => point.label),
      [...MONTH_SHORT_LABELS_FR],
    );
    assert.equal(series[0]!.label, "janv.");
    assert.equal(series[1]!.label, "févr.");
    assert.equal(series[7]!.label, "août");
    assert.equal(series[11]!.label, "déc.");
    for (const point of series) {
      assert.equal(point.cents, BigInt(0));
      assert.equal(point.amount, "0.00");
    }
  });

  test("somme par mois en cents, sans erreur flottante", () => {
    const series = buildMonthlyCollectionSeries(
      [
        { amount: "0.10", paidAt: fromParisDateTime(2026, 3, 5, 10) },
        { amount: "0.20", paidAt: fromParisDateTime(2026, 3, 20, 15) },
        { amount: "1200.50", paidAt: fromParisDateTime(2026, 5, 2, 9) },
      ],
      2026,
    );
    assert.equal(series[2]!.cents, BigInt(30));
    assert.equal(series[2]!.amount, "0.30");
    assert.equal(series[4]!.cents, BigInt(120050));
    assert.equal(series[4]!.amount, "1200.50");
    assert.equal(series[3]!.amount, "0.00");
  });

  test("accepte paidAt en string ISO et en Date", () => {
    const series = buildMonthlyCollectionSeries(
      [
        { amount: "100.00", paidAt: "2026-06-15T10:00:00.000Z" },
        { amount: "50.00", paidAt: new Date("2026-06-16T10:00:00.000Z") },
      ],
      2026,
    );
    assert.equal(series[5]!.amount, "150.00");
  });

  test("minuit Paris : 31 janv. 23:30 Paris reste en janvier, 1er févr. 00:30 Paris passe en février", () => {
    const lateJan = fromParisDateTime(2026, 1, 31, 23, 30);
    const earlyFeb = fromParisDateTime(2026, 2, 1, 0, 30);
    // En hiver, 23:30 Paris = 22:30 UTC et 00:30 Paris = 23:30 UTC : même jour UTC (31 janv.).
    assert.equal(lateJan.toISOString().slice(0, 10), "2026-01-31");
    assert.equal(earlyFeb.toISOString().slice(0, 10), "2026-01-31");

    const series = buildMonthlyCollectionSeries(
      [
        { amount: "10.00", paidAt: lateJan },
        { amount: "20.00", paidAt: earlyFeb },
      ],
      2026,
    );
    assert.equal(series[0]!.amount, "10.00");
    assert.equal(series[1]!.amount, "20.00");
  });

  test("changement d'année : 31 déc. 23:30 Paris reste en 2025, 1er janv. 00:30 Paris est en 2026", () => {
    const lateDec = fromParisDateTime(2025, 12, 31, 23, 30);
    const earlyJan = fromParisDateTime(2026, 1, 1, 0, 30);
    const payments = [
      { amount: "300.00", paidAt: lateDec },
      { amount: "40.00", paidAt: earlyJan },
    ];

    const s2025 = buildMonthlyCollectionSeries(payments, 2025);
    assert.equal(s2025[11]!.amount, "300.00");
    assert.equal(s2025[0]!.amount, "0.00");

    const s2026 = buildMonthlyCollectionSeries(payments, 2026);
    assert.equal(s2026[0]!.amount, "40.00");
    assert.equal(s2026[11]!.amount, "0.00");
  });

  test("heure d'été : 30 avr. 23:30 Paris (21:30 UTC) reste en avril, 1er mai 00:30 Paris (22:30 UTC le 30 avr.) est en mai", () => {
    const lateApr = fromParisDateTime(2026, 4, 30, 23, 30);
    const earlyMay = fromParisDateTime(2026, 5, 1, 0, 30);
    assert.equal(earlyMay.toISOString(), "2026-04-30T22:30:00.000Z");

    const series = buildMonthlyCollectionSeries(
      [
        { amount: "5.00", paidAt: lateApr },
        { amount: "7.00", paidAt: earlyMay },
      ],
      2026,
    );
    assert.equal(series[3]!.amount, "5.00");
    assert.equal(series[4]!.amount, "7.00");
  });

  test("instant UTC du 31 déc. 23:30 est déjà le 1er janv. à Paris", () => {
    const series = buildMonthlyCollectionSeries(
      [{ amount: "99.00", paidAt: "2025-12-31T23:30:00.000Z" }],
      2026,
    );
    assert.equal(series[0]!.amount, "99.00");
    const previous = buildMonthlyCollectionSeries(
      [{ amount: "99.00", paidAt: "2025-12-31T23:30:00.000Z" }],
      2025,
    );
    assert.equal(previous[11]!.amount, "0.00");
  });

  test("ignore les paiements d'une autre année et les dates illisibles", () => {
    const series = buildMonthlyCollectionSeries(
      [
        { amount: "500.00", paidAt: fromParisDateTime(2025, 7, 1, 12) },
        { amount: "600.00", paidAt: fromParisDateTime(2027, 7, 1, 12) },
        { amount: "700.00", paidAt: "pas-une-date" },
      ],
      2026,
    );
    assert.ok(series.every((point) => point.cents === BigInt(0)));
  });

  test("montants avec virgule et grands montants restent exacts", () => {
    const series = buildMonthlyCollectionSeries(
      [
        { amount: "12345678.99", paidAt: fromParisDateTime(2026, 9, 10, 12) },
        { amount: "0,01", paidAt: fromParisDateTime(2026, 9, 11, 12) },
      ],
      2026,
    );
    assert.equal(series[8]!.cents, BigInt(1234567900));
    assert.equal(series[8]!.amount, "12345679.00");
  });
});
