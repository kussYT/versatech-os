import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  GEOCODE_MISSING_FLAG,
  assertGeocodeMissingAllowed,
  isGeocodeMissingAllowed,
} from "./geocode-missing-guard";

describe("geocode missing companies guard", () => {
  test("production without flag => refus", () => {
    assert.equal(isGeocodeMissingAllowed({ NODE_ENV: "production" }), false);
    assert.throws(
      () => assertGeocodeMissingAllowed({ NODE_ENV: "production" }),
      new RegExp(GEOCODE_MISSING_FLAG),
    );
  });

  test("production with flag true => autorisé", () => {
    const env = { NODE_ENV: "production", ALLOW_GEOCODE_MISSING_COMPANIES: "true" };
    assert.equal(isGeocodeMissingAllowed(env), true);
    assert.doesNotThrow(() => assertGeocodeMissingAllowed(env));
  });
});
