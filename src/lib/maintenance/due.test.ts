import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fromParisDateTime, parisDateKey } from "@/lib/dates";
import {
  addCivilMonths,
  isUpcomingMaintenanceDue,
  nextMaintenanceDueDate,
} from "./due";

describe("échéances mensuelles", () => {
  it("garde le jour d'anniversaire et cale le 31", () => {
    assert.deepEqual(addCivilMonths({ year: 2026, month: 1, day: 31 }, 1), {
      year: 2026,
      month: 2,
      day: 28,
    });
    assert.deepEqual(addCivilMonths({ year: 2026, month: 1, day: 15 }, 1), {
      year: 2026,
      month: 2,
      day: 15,
    });
  });

  it("prochaine échéance = startDate si futur ou aujourd'hui", () => {
    const start = fromParisDateTime(2026, 10, 1);
    const now = fromParisDateTime(2026, 9, 16, 15, 0, 0, 0);
    const due = nextMaintenanceDueDate({
      startDate: start,
      status: "ACTIVE",
      now,
    });
    assert.ok(due);
    assert.equal(parisDateKey(due), "2026-10-01");
  });

  it("saute au prochain mois si l'anniversaire est passé", () => {
    const start = fromParisDateTime(2026, 1, 10);
    const now = fromParisDateTime(2026, 9, 16, 10, 0, 0, 0);
    const due = nextMaintenanceDueDate({
      startDate: start,
      status: "ACTIVE",
      now,
    });
    assert.ok(due);
    assert.equal(parisDateKey(due), "2026-10-10");
  });

  it("n'a pas d'échéance si suspendu / terminé / au-delà de endDate", () => {
    const start = fromParisDateTime(2026, 1, 10);
    const now = fromParisDateTime(2026, 9, 16);
    assert.equal(
      nextMaintenanceDueDate({ startDate: start, status: "PAUSED", now }),
      null,
    );
    assert.equal(
      nextMaintenanceDueDate({
        startDate: start,
        endDate: fromParisDateTime(2026, 8, 1),
        status: "ACTIVE",
        now,
      }),
      null,
    );
  });

  it("repère les échéances dans les 30 jours Paris", () => {
    const now = fromParisDateTime(2026, 9, 16, 12, 0, 0, 0);
    const soon = fromParisDateTime(2026, 10, 10);
    const later = fromParisDateTime(2026, 11, 1);
    assert.equal(isUpcomingMaintenanceDue(soon, now), true);
    assert.equal(isUpcomingMaintenanceDue(later, now), false);
  });
});
