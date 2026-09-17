import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { applicationSecurityHeaders, contentSecurityPolicy } from "./headers";

describe("application security headers", () => {
  test("includes CSP frame-ancestors none and complementary browser headers", () => {
    const headers = applicationSecurityHeaders("test-nonce", false);
    assert.equal(headers["X-Content-Type-Options"], "nosniff");
    assert.equal(headers["Referrer-Policy"], "strict-origin-when-cross-origin");
    assert.equal(headers["X-Frame-Options"], "DENY");
    assert.match(headers["Permissions-Policy"], /camera=\(\)/);
    assert.match(headers["Content-Security-Policy"], /frame-ancestors 'none'/);
    assert.match(headers["Content-Security-Policy"], /nonce-test-nonce/);
    assert.doesNotMatch(headers["Content-Security-Policy"], /upgrade-insecure-requests/);
    assert.doesNotMatch(headers["Content-Security-Policy"], /Strict-Transport-Security/);
  });

  test("allows Leaflet OSM tiles and inline styles", () => {
    const csp = contentSecurityPolicy("n", false);
    assert.match(csp, /style-src 'self' 'unsafe-inline'/);
    assert.match(csp, /tile\.openstreetmap\.org/);
    assert.doesNotMatch(csp, /unsafe-eval/);
  });

  test("keeps unsafe-eval only in development", () => {
    assert.match(contentSecurityPolicy("n", true), /unsafe-eval/);
    assert.doesNotMatch(contentSecurityPolicy("n", false), /unsafe-eval/);
  });
});
