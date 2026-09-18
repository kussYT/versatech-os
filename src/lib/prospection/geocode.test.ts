import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  NOMINATIM_TIMEOUT_MS,
  PROTECTED_GEOCODE_COMPANY_ID,
  hasGeocodableStreetAddress,
  isNominatimConfigured,
  nominatimRequestInit,
  parseNominatimHit,
  planCompanyGeocode,
  geocodeQueryForCompany,
  shouldSkipGeocode,
} from "./geocode";

describe("nominatim parse", () => {
  it("reads lat/lon from the first hit", () => {
    const hit = parseNominatimHit([
      { lat: "45.76", lon: "4.84", display_name: "Lyon" },
    ]);
    assert.deepEqual(hit, { lat: 45.76, lon: 4.84, displayName: "Lyon" });
  });

  it("skips geocode when the same address is already persisted", () => {
    assert.equal(
      shouldSkipGeocode(
        { latitude: 45, longitude: 4, geocodedAddress: "12 rue Test, Lyon" },
        "12 rue Test, Lyon",
      ),
      true,
    );
    assert.equal(
      shouldSkipGeocode({ latitude: null, longitude: null }, "12 rue Test, Lyon"),
      false,
    );
  });

  it("disables automatic geocoding without a Nominatim user agent", () => {
    assert.equal(isNominatimConfigured(""), false);
    assert.equal(isNominatimConfigured("   "), false);
    assert.equal(isNominatimConfigured("VersaTech OS CRM (ops@versatech.example)"), true);
  });

  it("attaches a timeout abort signal to Nominatim fetches", () => {
    const init = nominatimRequestInit("VersaTech OS CRM (ops@versatech.example)");
    assert.equal(NOMINATIM_TIMEOUT_MS, 8_000);
    assert.ok(init.signal instanceof AbortSignal);
    assert.equal(init.cache, "no-store");
    const headers = new Headers(init.headers);
    assert.equal(headers.get("User-Agent"), "VersaTech OS CRM (ops@versatech.example)");
  });
});

describe("geocodage idempotent sans coordonnées inventées", () => {
  const base = {
    id: "co_1",
    name: "HL BEAUTY",
    address: "48 Avenue Villars",
    postalCode: "59300",
    city: "Valenciennes",
    country: "FR",
    latitude: null as number | null,
    longitude: null as number | null,
    geocodedAddress: null as string | null,
    geocodeStatus: null as null,
  };

  it("fetches only when a street address with a number is present", () => {
    assert.equal(hasGeocodableStreetAddress({ address: "48 Avenue Villars" }), true);
    assert.equal(hasGeocodableStreetAddress({ address: null }), false);
    assert.equal(hasGeocodableStreetAddress({ address: "Valenciennes" }), false);
    assert.equal(planCompanyGeocode(base).action, "fetch");
  });

  it("does not invent coordinates for a city-only company", () => {
    const plan = planCompanyGeocode({
      ...base,
      name: "L'Instant Gourmand",
      address: null,
      postalCode: null,
    });
    assert.equal(plan.action, "mark_manual");
    assert.equal("lat" in plan, false);
    assert.equal("lng" in plan, false);
  });

  it("skips companies that already have coordinates", () => {
    const plan = planCompanyGeocode({
      ...base,
      latitude: 50.35,
      longitude: 3.52,
      geocodedAddress: "48 Avenue Villars, 59300 Valenciennes, FR",
      geocodeStatus: "OK",
    });
    assert.equal(plan.action, "skip");
    if (plan.action === "skip") {
      assert.equal(plan.reason, "has_coords");
    }
  });

  it("does not retry the same failed query", () => {
    const queryCompany = {
      ...base,
      geocodeStatus: "FAILED" as const,
      geocodedAddress: geocodeQueryForCompany(base),
    };
    const plan = planCompanyGeocode(queryCompany);
    assert.equal(plan.action, "skip");
    if (plan.action === "skip") {
      assert.equal(plan.reason, "already_failed");
    }
  });

  it("never geocodes the protected ALEX company", () => {
    const plan = planCompanyGeocode({
      ...base,
      id: PROTECTED_GEOCODE_COMPANY_ID,
      name: "ALEX'CEPTION",
    });
    assert.equal(plan.action, "skip");
    if (plan.action === "skip") {
      assert.equal(plan.reason, "protected");
    }
  });
});
