import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { fromParisDateTime, parisDateKey } from "@/lib/dates";
import { tourStopToCalendarItem, tourStopsToCalendarItems } from "./terrain-visits";

const monday = fromParisDateTime(2026, 9, 21, 0, 0, 0, 0);

describe("projection TourStop → calendrier", () => {
  test("maps a pending stop to an all-day terrain visit without inventing an hour", () => {
    const item = tourStopToCalendarItem({
      stopId: "stop_1",
      order: 1,
      visitedAt: null,
      tourDate: monday,
      company: { id: "co_hl", name: "HL BEAUTY" },
    });

    assert.equal(item.kind, "terrain_visit");
    assert.equal(item.title, "Visite terrain — HL BEAUTY");
    assert.equal(item.allDay, true);
    assert.equal(item.editable, false);
    assert.equal(item.eventType, null);
    assert.equal(item.visitStatus, "pending");
    assert.equal(item.visitOrder, 1);
    assert.equal(item.href, "/entreprises/co_hl");
    assert.equal(item.secondaryHref, "/tournee");
    assert.equal(parisDateKey(item.startsAt), "2026-09-21");
    assert.equal(parisDateKey(item.endsAt), "2026-09-21");
    assert.doesNotMatch(item.title, /09:00|10:00/);
    assert.equal(item.id.startsWith("terrain_visit:"), true);
  });

  test("marks a visited stop without creating a CalendarEvent payload", () => {
    const item = tourStopToCalendarItem({
      stopId: "stop_2",
      order: 1,
      visitedAt: fromParisDateTime(2026, 9, 21, 11, 30, 0, 0),
      tourDate: monday,
      company: { id: "co_m", name: "Artisan Mickael couvreur" },
    });

    assert.equal(item.visitStatus, "visited");
    assert.equal(item.kind === "event", false);
    assert.equal("calendarEventId" in item, false);
  });

  test("uses the Europe/Paris civil day even when the tour instant is the previous UTC date", () => {
    const item = tourStopToCalendarItem({
      stopId: "stop_3",
      order: 1,
      visitedAt: null,
      tourDate: new Date("2026-09-20T22:00:00.000Z"),
      company: { id: "co_p", name: "Premium auto" },
    });
    assert.equal(parisDateKey(item.startsAt), "2026-09-21");
  });

  test("a removed stop is absent from the projection", () => {
    const remaining = tourStopsToCalendarItems([
      {
        stopId: "keep",
        order: 1,
        visitedAt: null,
        tourDate: monday,
        company: { id: "co_s", name: "Sébastien Marin Artisan Ebéniste" },
      },
    ]);
    assert.equal(remaining.length, 1);
    assert.equal(remaining.some((entry) => entry.entityId === "deleted"), false);
  });
});
