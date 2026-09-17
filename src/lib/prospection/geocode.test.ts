import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  NOMINATIM_TIMEOUT_MS,
  isNominatimConfigured,
  nominatimRequestInit,
  parseNominatimHit,
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
