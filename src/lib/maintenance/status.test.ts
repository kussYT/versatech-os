import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canTransitionMaintenanceStatus,
  isActiveMaintenanceStatus,
  isInactiveMaintenanceStatus,
  isTerminalMaintenanceStatus,
  maintenanceTerminationDate,
} from "./status";

describe("transitions de statut maintenance", () => {
  it("autorise activer / suspendre / terminer", () => {
    assert.equal(canTransitionMaintenanceStatus("ACTIVE", "PAUSED"), true);
    assert.equal(canTransitionMaintenanceStatus("ACTIVE", "ENDED"), true);
    assert.equal(canTransitionMaintenanceStatus("PAUSED", "ACTIVE"), true);
    assert.equal(canTransitionMaintenanceStatus("PAUSED", "ENDED"), true);
  });

  it("refuse les transitions hors cycle", () => {
    assert.equal(canTransitionMaintenanceStatus("ACTIVE", "CANCELED"), false);
    assert.equal(canTransitionMaintenanceStatus("ENDED", "ACTIVE"), false);
    assert.equal(canTransitionMaintenanceStatus("ENDED", "PAUSED"), false);
    assert.equal(canTransitionMaintenanceStatus("CANCELED", "ACTIVE"), false);
    assert.equal(canTransitionMaintenanceStatus("PAUSED", "CANCELED"), false);
  });

  it("classe actif vs suspendu/terminé", () => {
    assert.equal(isActiveMaintenanceStatus("ACTIVE"), true);
    assert.equal(isActiveMaintenanceStatus("PAUSED"), false);
    assert.equal(isInactiveMaintenanceStatus("PAUSED"), true);
    assert.equal(isInactiveMaintenanceStatus("ENDED"), true);
    assert.equal(isInactiveMaintenanceStatus("CANCELED"), true);
    assert.equal(isInactiveMaintenanceStatus("ACTIVE"), false);
    assert.equal(isTerminalMaintenanceStatus("ENDED"), true);
    assert.equal(isTerminalMaintenanceStatus("CANCELED"), true);
    assert.equal(isTerminalMaintenanceStatus("PAUSED"), false);
  });

  it("accepte un no-op (même statut)", () => {
    assert.equal(canTransitionMaintenanceStatus("ACTIVE", "ACTIVE"), true);
  });
});

describe("date de fin à la terminaison", () => {
  it("pose aujourd'hui si aucune fin ou fin future", () => {
    const today = new Date("2026-09-16T22:00:00.000Z");
    const future = new Date("2026-12-01T00:00:00.000Z");
    const past = new Date("2026-01-01T00:00:00.000Z");
    assert.equal(maintenanceTerminationDate(null, today).toISOString(), today.toISOString());
    assert.equal(maintenanceTerminationDate(future, today).toISOString(), today.toISOString());
    assert.equal(maintenanceTerminationDate(past, today).toISOString(), past.toISOString());
  });
});
