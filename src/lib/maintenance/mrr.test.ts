import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeMrr, hasMaintenanceStarted } from "./mrr";

describe("MRR maintenance", () => {
  it("somme uniquement les contrats ACTIVE déjà commencés", () => {
    const now = new Date("2026-09-16T12:00:00.000Z");
    const snapshot = computeMrr(
      [
        { status: "ACTIVE", monthlyAmount: "89.50", startDate: "2026-08-01T00:00:00.000Z" },
        { status: "ACTIVE", monthlyAmount: "10.50", startDate: "2026-09-16T00:00:00.000Z" },
        { status: "PAUSED", monthlyAmount: "200.00", startDate: "2026-01-01T00:00:00.000Z" },
        { status: "ENDED", monthlyAmount: "40.00", startDate: "2026-01-01T00:00:00.000Z" },
        { status: "CANCELED", monthlyAmount: "15.00", startDate: "2026-01-01T00:00:00.000Z" },
      ],
      now,
    );

    assert.equal(snapshot.mrr, "100.00");
    assert.equal(snapshot.arr, "1200.00");
    assert.equal(snapshot.activeCount, 2);
  });

  it("exclut un contrat ACTIVE dont startDate est dans le futur (Europe/Paris)", () => {
    const now = new Date("2026-09-16T12:00:00.000Z");
    const snapshot = computeMrr(
      [
        { status: "ACTIVE", monthlyAmount: "89.00", startDate: "2026-08-01T00:00:00.000Z" },
        { status: "ACTIVE", monthlyAmount: "199.00", startDate: "2026-10-01T00:00:00.000Z" },
      ],
      now,
    );

    assert.equal(snapshot.mrr, "89.00");
    assert.equal(snapshot.arr, "1068.00");
    assert.equal(snapshot.activeCount, 1);
  });

  it("retourne 0.00 sans contrat actif", () => {
    const snapshot = computeMrr([
      { status: "PAUSED", monthlyAmount: "80.00" },
      { status: "ENDED", monthlyAmount: "80.00" },
    ]);

    assert.equal(snapshot.mrr, "0.00");
    assert.equal(snapshot.arr, "0.00");
    assert.equal(snapshot.activeCount, 0);
  });

  it("conserve les centimes (pas de Float)", () => {
    const snapshot = computeMrr([
      { status: "ACTIVE", monthlyAmount: "0.10" },
      { status: "ACTIVE", monthlyAmount: "0.20" },
    ]);

    assert.equal(snapshot.mrr, "0.30");
    assert.equal(snapshot.arr, "3.60");
  });
});

describe("hasMaintenanceStarted — Europe/Paris", () => {
  it("traite une startDate absente comme déjà commencée", () => {
    assert.equal(hasMaintenanceStarted(undefined, new Date("2026-09-16T12:00:00.000Z")), true);
  });

  it("commence le jour civil Paris, pas avant", () => {
    const now = new Date("2026-09-16T12:00:00.000Z");
    assert.equal(hasMaintenanceStarted("2026-09-16T00:00:00.000Z", now), true);
    assert.equal(hasMaintenanceStarted("2026-09-17T00:00:00.000Z", now), false);
  });
});
