import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  WEB_SEARCH_MAX_BODY_BYTES,
  WEB_SEARCH_TIMEOUT_MS,
  isBlockedSearxngHostname,
  isLoopbackSearxngHostname,
  isSameConfiguredOrigin,
  parseSearxngBaseUrl,
  resolveSearxngOrigin,
  clearSearxngOriginCache,
} from "./ssrf";

describe("SearXNG SSRF allowlist", () => {
  test("timeout and body limits are bounded (Nominatim-style 8s)", () => {
    assert.equal(WEB_SEARCH_TIMEOUT_MS, 8_000);
    assert.equal(WEB_SEARCH_MAX_BODY_BYTES, 256 * 1024);
  });

  test("rejects RFC1918, link-local, file, ftp, and non-canonical numeric hosts", () => {
    const blocked = [
      "",
      "   ",
      "http://169.254.169.254/",
      "http://169.254.1.1/",
      "http://10.1.2.3/",
      "http://172.16.0.1/",
      "http://172.31.255.1/",
      "http://192.168.1.1/",
      "http://[fe80::1]/",
      "http://[fc00::1]/",
      "file:///etc/passwd",
      "ftp://searx.example.com",
      "javascript:alert(1)",
      "http://user:pass@searx.example.com",
    ];
    for (const raw of blocked) {
      assert.equal(parseSearxngBaseUrl(raw), null, raw);
    }
  });

  test("1. operator SEARXNG_BASE_URL on 127.0.0.1:8080 is allowed", () => {
    const origin = parseSearxngBaseUrl("http://127.0.0.1:8080");
    assert.ok(origin);
    assert.equal(origin?.origin, "http://127.0.0.1:8080");
    assert.equal(origin?.searchUrl, "http://127.0.0.1:8080/search");
    assert.equal(origin?.hostname, "127.0.0.1");
    assert.equal(isLoopbackSearxngHostname(origin?.hostname), true);

    const localhost = parseSearxngBaseUrl("http://localhost:8080");
    assert.ok(localhost);
    assert.equal(localhost?.origin, "http://localhost:8080");

    const mapped = parseSearxngBaseUrl("http://[::ffff:127.0.0.1]:8080");
    assert.ok(mapped);

    const v6 = parseSearxngBaseUrl("http://[::1]:8080");
    assert.ok(v6);

    const decimalAlias = parseSearxngBaseUrl("http://2130706433:8080");
    assert.ok(decimalAlias);
    assert.equal(decimalAlias?.hostname, "127.0.0.1");
  });

  test("untrusted hostnames still block loopback, metadata, and RFC1918", () => {
    assert.equal(isBlockedSearxngHostname("127.0.0.1"), true);
    assert.equal(isBlockedSearxngHostname("localhost"), true);
    assert.equal(isBlockedSearxngHostname("169.254.169.254"), true);
    assert.equal(isBlockedSearxngHostname("10.1.2.3"), true);
    assert.equal(isBlockedSearxngHostname("192.168.1.1"), true);
  });

  test("allows public http(s) origins and builds a /search endpoint", () => {
    const https = parseSearxngBaseUrl("https://searx.example.com");
    assert.ok(https);
    assert.equal(https?.origin, "https://searx.example.com");
    assert.equal(https?.searchUrl, "https://searx.example.com/search");
    assert.equal(https?.protocol, "https:");

    const prefixed = parseSearxngBaseUrl("https://searx.example.com/searxng/");
    assert.equal(prefixed?.searchUrl, "https://searx.example.com/searxng/search");

    const withPort = parseSearxngBaseUrl("http://searx.example.com:8443/app");
    assert.equal(withPort?.origin, "http://searx.example.com:8443");
    assert.equal(withPort?.searchUrl, "http://searx.example.com:8443/app/search");

    const public172 = parseSearxngBaseUrl("http://172.32.0.1");
    assert.ok(public172);
    assert.equal(isBlockedSearxngHostname("172.32.0.1"), false);
  });

  test("parses a given base URL once (cache keyed by trimmed string)", () => {
    clearSearxngOriginCache();
    const first = resolveSearxngOrigin(" https://searx.example.com ");
    const second = resolveSearxngOrigin("https://searx.example.com");
    assert.equal(first, second);
    assert.ok(resolveSearxngOrigin("http://127.0.0.1:8080"));
    assert.equal(resolveSearxngOrigin("http://169.254.169.254"), null);
  });

  test("same-origin check accepts configured loopback /search URLs", () => {
    const origin = parseSearxngBaseUrl("http://127.0.0.1:8080");
    assert.ok(origin);
    const search = new URL("http://127.0.0.1:8080/search?q=seo&format=json");
    assert.equal(isSameConfiguredOrigin(search, origin!), true);
    assert.equal(isSameConfiguredOrigin(new URL("http://127.0.0.1:9/search"), origin!), false);
    assert.equal(isSameConfiguredOrigin(new URL("http://169.254.169.254/latest"), origin!), false);
  });
});
