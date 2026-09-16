import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeAnalytics, type AnalyticsSnapshot } from "@/lib/analytics/compute";
import { fromParisDateTime } from "@/lib/dates";
import { externalItineraryUrl } from "./itinerary";
import {
  VISIT_INTERACTION_DIRECTION,
  VISIT_INTERACTION_RESULT,
  VISIT_INTERACTION_TYPE,
  VISIT_NOTES,
  buildVisitInteractionFields,
  isTerrainVisit,
} from "./visit";

describe("terrain visit payload", () => {
  it("builds an identifiable MEETING that is not a commercial RDV", () => {
    const payload = buildVisitInteractionFields("co_1", new Date("2026-09-16T10:00:00.000Z"));
    assert.equal(payload.type, VISIT_INTERACTION_TYPE);
    assert.equal(payload.direction, VISIT_INTERACTION_DIRECTION);
    assert.equal(payload.result, VISIT_INTERACTION_RESULT);
    assert.equal(payload.notes, VISIT_NOTES);
    assert.equal(payload.companyId, "co_1");
    assert.equal(
      isTerrainVisit(payload),
      true,
    );
  });

  it("does not treat a commercial meeting as a terrain visit", () => {
    assert.equal(
      isTerrainVisit({
        type: "MEETING",
        direction: "OUTBOUND",
        result: "MEETING_BOOKED",
        notes: "Démo produit",
      }),
      false,
    );
    assert.equal(isTerrainVisit({ type: "CALL", notes: VISIT_NOTES }), false);
  });
});

describe("itinerary helper", () => {
  it("prefers persisted coordinates when present", () => {
    const url = externalItineraryUrl({
      name: "Atelier",
      address: "12 rue des Fleurs",
      city: "Lyon",
      latitude: 45.76,
      longitude: 4.84,
    });
    assert.match(url, /openstreetmap\.org\/directions\?to=45\.76%2C4\.84/);
  });

  it("falls back to address search without inventing coordinates", () => {
    const url = externalItineraryUrl({
      name: "Atelier",
      address: "12 rue des Fleurs",
      postalCode: "69001",
      city: "Lyon",
      country: "FR",
    });
    assert.match(url, /openstreetmap\.org\/search/);
    assert.match(url, /12%20rue%20des%20Fleurs/);
  });
});

describe("analytics RDV vs visite terrain", () => {
  it("excludes terrain visits from the meetings KPI while counting a real RDV", () => {
    const at = fromParisDateTime(2026, 9, 10, 11, 0, 0, 0);
    const snapshot: AnalyticsSnapshot = {
      companies: [],
      interactions: [
        { occurredAt: at, type: "MEETING", direction: "OUTBOUND", result: null, notes: "RDV commercial" },
        {
          occurredAt: at,
          type: "MEETING",
          direction: "INTERNAL",
          result: "OTHER",
          notes: "Visite terrain",
        },
      ],
      opportunities: [],
      quotes: [],
      projects: [],
      payments: [],
      contracts: [],
    };

    const report = computeAnalytics(snapshot, "30d", fromParisDateTime(2026, 9, 16, 15, 0, 0, 0));
    assert.equal(report.commercial.meetings, 1);
    assert.equal(report.commercial.contactsMade, 2);
  });
});
