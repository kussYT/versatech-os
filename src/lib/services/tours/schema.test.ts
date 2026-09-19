import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { TodayTour } from "@/lib/queries/tours";
import { mapTodayTour } from "./map";
import {
  isPlainJsonValue,
  parseTodayTour,
  requireServiceActor,
  serializeTodayTour,
  TODAY_TOUR_STOP_LIMIT,
  todayTourSchema,
  type TodayTourDto,
} from "./schema";

const actor = {
  id: "user_1",
  name: "Marius",
  email: "marius@versatech.example",
  role: "ADMIN" as const,
};

function sampleLoaded(): TodayTour {
  return {
    id: "tour_1",
    date: "2026-09-18T22:00:00.000Z",
    stops: [
      {
        id: "stop_1",
        order: 1,
        visitedAt: null,
        company: {
          id: "co_hl",
          name: "HL BEAUTY",
          lifecycleStatus: "LEAD",
          address: "12 rue Test",
          city: "Lyon",
          postalCode: "69001",
          country: "FR",
          phone: "0472000000",
          latitude: 45.75,
          longitude: 4.85,
        },
      },
    ],
  };
}

describe("TourService getTodayTour schema", () => {
  test("null tour is valid for the agent", () => {
    assert.equal(parseTodayTour(null), null);
    assert.equal(serializeTodayTour(null), "null");
  });

  test("JSON roundtrip omits lat/lng/notes/href", () => {
    const mapped = mapTodayTour(sampleLoaded());
    assert.ok(mapped);
    const roundtrip = JSON.parse(JSON.stringify(mapped)) as unknown;
    assert.deepEqual(roundtrip, mapped);
    assert.deepEqual(parseTodayTour(roundtrip), mapped);
    assert.equal(isPlainJsonValue(mapped), true);
    const json = serializeTodayTour(mapped);
    assert.equal(json.includes("latitude"), false);
    assert.equal(json.includes("longitude"), false);
    assert.equal(json.includes('"notes"'), false);
    assert.equal(json.includes('"href"'), false);
    assert.equal(json.includes("45.75"), false);
  });

  test("truncated invariant: 50 stops max, planned can exceed", () => {
    const stops = Array.from({ length: TODAY_TOUR_STOP_LIMIT + 1 }, (_, index) => ({
      id: `stop_${index}`,
      order: index + 1,
      visitedAt: null,
      company: sampleLoaded().stops[0]!.company,
    }));
    const mapped = mapTodayTour({ id: "tour_big", date: "2026-09-18T22:00:00.000Z", stops });
    assert.equal(mapped?.truncated, true);
    assert.equal(mapped?.stops.length, TODAY_TOUR_STOP_LIMIT);
    assert.equal(mapped?.planned, TODAY_TOUR_STOP_LIMIT + 1);
    assert.equal(todayTourSchema.safeParse(mapped).success, true);
  });

  test("latitude on company is rejected", () => {
    const mapped = mapTodayTour(sampleLoaded()) as TodayTourDto;
    assert.equal(
      todayTourSchema.safeParse({
        ...mapped,
        stops: [{ ...mapped.stops[0]!, company: { ...mapped.stops[0]!.company, latitude: 45 } }],
      }).success,
      false,
    );
  });

  test("requireServiceActor throws when actor id is missing, without redirect", () => {
    assert.throws(() => requireServiceActor({ ...actor, id: "" }), /Acteur requis/);
    assert.throws(() => requireServiceActor(null), /Acteur requis/);
    assert.doesNotThrow(() => requireServiceActor(actor));
  });
});
