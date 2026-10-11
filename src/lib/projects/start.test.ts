import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fromParisDateTime } from "@/lib/dates";
import { startDateAfterDemarrer, validateExplicitStartDate } from "./start";

const NOW = fromParisDateTime(2026, 10, 8, 15, 0, 0, 0);

describe("startDateAfterDemarrer", () => {
  it("écrit le jour courant quand Planifié passe en Actif sans date", () => {
    const next = startDateAfterDemarrer({
      fromStatus: "PLANNED",
      toStatus: "ACTIVE",
      startDate: null,
      now: NOW,
    });
    assert.equal(next?.toISOString(), fromParisDateTime(2026, 10, 8, 0, 0, 0, 0).toISOString());
  });

  it("remplace une date future au moment de Démarrer", () => {
    const next = startDateAfterDemarrer({
      fromStatus: "PLANNED",
      toStatus: "ACTIVE",
      startDate: fromParisDateTime(2026, 11, 2, 0, 0, 0, 0),
      now: NOW,
    });
    assert.equal(next?.toISOString(), fromParisDateTime(2026, 10, 8, 0, 0, 0, 0).toISOString());
  });

  it("conserve une date de début déjà passée", () => {
    const existing = fromParisDateTime(2026, 9, 1, 0, 0, 0, 0);
    const next = startDateAfterDemarrer({
      fromStatus: "PLANNED",
      toStatus: "ACTIVE",
      startDate: existing,
      now: NOW,
    });
    assert.equal(next?.toISOString(), existing.toISOString());
  });

  it("ne fabrique pas de date pour un projet déjà Actif", () => {
    const next = startDateAfterDemarrer({
      fromStatus: "ACTIVE",
      toStatus: "WAITING_CLIENT",
      startDate: null,
      now: NOW,
    });
    assert.equal(next, null);
  });
});

describe("validateExplicitStartDate", () => {
  it("refuse une date future sur un projet Actif", () => {
    const result = validateExplicitStartDate({
      status: "ACTIVE",
      startDate: fromParisDateTime(2026, 12, 1, 0, 0, 0, 0),
      now: NOW,
    });
    assert.equal(result.ok, false);
  });

  it("accepte une correction dans le passé et une date prévue tant que le projet est Planifié", () => {
    assert.equal(
      validateExplicitStartDate({
        status: "ACTIVE",
        startDate: fromParisDateTime(2026, 9, 2, 0, 0, 0, 0),
        now: NOW,
      }).ok,
      true,
    );
    assert.equal(
      validateExplicitStartDate({
        status: "PLANNED",
        startDate: fromParisDateTime(2026, 12, 1, 0, 0, 0, 0),
        now: NOW,
      }).ok,
      true,
    );
  });
});
