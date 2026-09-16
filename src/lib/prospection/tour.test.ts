import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fromParisDateTime, parisDateKey } from "@/lib/dates";
import { VISIT_INTERACTION_TYPE, buildVisitInteractionFields } from "./visit";
import {
  addCompanyToStops,
  markStopVisited,
  moveStop,
  removeCompanyFromStops,
  todayVisitCompanyIdsFromStops,
  tourCivilKeyFor,
  tourDateFor,
  unvisitedCompanyIds,
  type TourStopDraft,
} from "./tour";

describe("Europe/Paris tour date", () => {
  it("keys the tour on the Paris civil day, not UTC", () => {
    const lateUtc = fromParisDateTime(2026, 9, 16, 0, 30, 0, 0);
    assert.equal(parisDateKey(lateUtc), "2026-09-16");
    assert.equal(tourCivilKeyFor(lateUtc), "2026-09-16");
    assert.equal(tourDateFor(lateUtc).toISOString(), fromParisDateTime(2026, 9, 16, 0, 0, 0, 0).toISOString());
  });

  it("uses the Paris civil day when UTC is still the previous calendar date", () => {
    const utcEvening = new Date("2026-09-15T22:30:00.000Z");
    assert.equal(tourCivilKeyFor(utcEvening), "2026-09-16");
  });
});

describe("tour stops", () => {
  it("adds and removes companies without duplicates", () => {
    let stops: TourStopDraft[] = [];
    stops = addCompanyToStops(stops, "a");
    stops = addCompanyToStops(stops, "b");
    stops = addCompanyToStops(stops, "a");
    assert.deepEqual(
      stops.map((stop) => stop.companyId),
      ["a", "b"],
    );
    stops = removeCompanyFromStops(stops, "a");
    assert.deepEqual(
      stops.map((stop) => [stop.companyId, stop.order]),
      [["b", 1]],
    );
  });

  it("reorders stops", () => {
    let stops: TourStopDraft[] = [
      { companyId: "a", order: 1, visitedAt: null },
      { companyId: "b", order: 2, visitedAt: null },
      { companyId: "c", order: 3, visitedAt: null },
    ];
    stops = moveStop(stops, "c", -1);
    assert.deepEqual(
      stops.map((stop) => stop.companyId),
      ["a", "c", "b"],
    );
  });

  it("marks a visit and exposes unvisited ids for the map hook", () => {
    let stops: TourStopDraft[] = [
      { companyId: "a", order: 1, visitedAt: null },
      { companyId: "b", order: 2, visitedAt: null },
    ];
    stops = markStopVisited(stops, "a", new Date("2026-09-16T08:00:00.000Z"));
    assert.ok(stops[0]?.visitedAt);
    assert.deepEqual(unvisitedCompanyIds(stops), ["b"]);
    assert.deepEqual(
      todayVisitCompanyIdsFromStops("2026-09-16", "2026-09-16", stops),
      ["b"],
    );
    assert.deepEqual(todayVisitCompanyIdsFromStops("2026-09-15", "2026-09-16", stops), []);
  });

  it("builds a real MEETING interaction payload for a visit", () => {
    const payload = buildVisitInteractionFields("co_1");
    assert.equal(payload.type, VISIT_INTERACTION_TYPE);
    assert.equal(payload.notes, "Visite terrain");
  });

  it("returns no map visits when there is no tour or an empty tour", () => {
    assert.deepEqual(unvisitedCompanyIds([]), []);
    assert.deepEqual(todayVisitCompanyIdsFromStops("2026-09-16", "2026-09-16", []), []);
    assert.deepEqual(todayVisitCompanyIdsFromStops("2026-09-15", "2026-09-16", [
      { companyId: "a", order: 1, visitedAt: null },
    ]), []);
  });

  it("leaves 3 remaining map ids after 5 stops with 2 visited", () => {
    let stops: TourStopDraft[] = ["a", "b", "c", "d", "e"].map((companyId, index) => ({
      companyId,
      order: index + 1,
      visitedAt: null,
    }));
    stops = markStopVisited(stops, "a", new Date("2026-09-16T08:00:00.000Z"));
    stops = markStopVisited(stops, "c", new Date("2026-09-16T09:00:00.000Z"));
    assert.deepEqual(unvisitedCompanyIds(stops), ["b", "d", "e"]);
    assert.deepEqual(
      todayVisitCompanyIdsFromStops("2026-09-16", "2026-09-16", stops),
      ["b", "d", "e"],
    );
  });
});
