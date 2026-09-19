/**
 * Wave 7 — SearXNG adapter security (injected fetch / MockWebSearchProvider).
 * No live public instance. No ALEX'CEPTION writes.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  MockWebSearchProvider,
  SearxngWebSearchProvider,
  WEB_SEARCH_UNAVAILABLE,
  WEB_SEARCH_UNAVAILABLE_MESSAGE,
  WebSearchService,
  WebSearchUnavailableError,
  isBlockedSearxngHostname,
  parseSearxngBaseUrl,
  parseWebSearchInput,
} from "@/lib/services/web-search";
import type { FetchLike } from "@/lib/services/web-search/searxng";

const CONFIGURED = "https://searx.test.invalid";
const ORIGIN = parseSearxngBaseUrl(CONFIGURED);
assert.ok(ORIGIN);

function recordingFetch(impl: (url: string, init?: RequestInit) => Promise<Response>): {
  fetchFn: FetchLike;
  urls: string[];
} {
  const urls: string[] = [];
  const fetchFn: FetchLike = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : String(input);
    urls.push(url);
    return impl(url, init);
  };
  return { fetchFn, urls };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("MockWebSearchProvider", () => {
  test("returns injected hits and never fetches", async () => {
    const provider = new MockWebSearchProvider([
      { title: "Bistrot", url: "https://example.com/bistrot", snippet: "Valenciennes" },
    ]);
    const dto = await provider.search(parseWebSearchInput({ query: "restaurants Valenciennes" }));
    assert.equal(dto.query, "restaurants Valenciennes");
    assert.equal(dto.results[0]?.url, "https://example.com/bistrot");
    assert.equal(provider.calls.length, 1);
  });
});

describe("SSRF: configured origin only", () => {
  test("parseSearxngBaseUrl allows same-VPS loopback; still rejects metadata and RFC1918", () => {
    assert.equal(parseSearxngBaseUrl(""), null);
    const loopback = parseSearxngBaseUrl("http://127.0.0.1:8080");
    assert.ok(loopback);
    assert.equal(loopback?.searchUrl, "http://127.0.0.1:8080/search");
    assert.ok(parseSearxngBaseUrl("http://localhost:8080"));
    assert.equal(parseSearxngBaseUrl("http://169.254.169.254/latest"), null);
    assert.equal(parseSearxngBaseUrl("http://10.0.0.8"), null);
    assert.equal(parseSearxngBaseUrl("http://192.168.1.1"), null);
    assert.equal(parseSearxngBaseUrl("file:///etc/passwd"), null);
    assert.equal(parseSearxngBaseUrl("ftp://searx.test.invalid"), null);
    assert.equal(isBlockedSearxngHostname("127.0.0.1"), true);
    assert.equal(isBlockedSearxngHostname("localhost"), true);
    assert.equal(isBlockedSearxngHostname("169.254.169.254"), true);
    assert.ok(parseSearxngBaseUrl(CONFIGURED));
  });

  test("tool/user baseUrl is stripped; fetch uses the server origin", async () => {
    const { fetchFn, urls } = recordingFetch(async () =>
      jsonResponse({ results: [{ title: "Ok", url: "https://example.com", content: "x" }] }),
    );
    const result = await WebSearchService.search(
      {
        query: "Next.js",
        baseUrl: "http://127.0.0.1",
        host: "169.254.169.254",
        url: "http://localhost/search",
        SEARXNG_BASE_URL: "http://evil.example",
      },
      { baseUrl: CONFIGURED, fetchImpl: fetchFn as typeof fetch },
    );
    assert.equal(result.ok, true);
    assert.equal(urls.length, 1);
    assert.match(urls[0] ?? "", /^https:\/\/searx\.test\.invalid\/search\?/);
    assert.doesNotMatch(urls[0] ?? "", /127\.0\.0\.1|localhost|169\.254|evil\.example/);
  });
});

describe("timeout / body / unavailable", () => {
  test("timeout maps to WEB_SEARCH_UNAVAILABLE without invented hits", async () => {
    const { fetchFn } = recordingFetch(async (_url, init) => {
      await new Promise<void>((_, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      });
      return jsonResponse({ results: [{ title: "invented", url: "https://example.com", content: "no" }] });
    });
    const provider = new SearxngWebSearchProvider(ORIGIN, fetchFn, 15, 8_192);
    await assert.rejects(
      () => provider.search(parseWebSearchInput({ query: "timeout" })),
      (error: unknown) => error instanceof WebSearchUnavailableError && error.code === WEB_SEARCH_UNAVAILABLE,
    );
  });

  test("huge body is rejected as WEB_SEARCH_UNAVAILABLE", async () => {
    const { fetchFn } = recordingFetch(async () =>
      jsonResponse({
        results: [{ title: "big", url: "https://example.com", content: "x".repeat(20_000) }],
      }),
    );
    const provider = new SearxngWebSearchProvider(ORIGIN, fetchFn, 8_000, 512);
    await assert.rejects(
      () => provider.search(parseWebSearchInput({ query: "huge" })),
      (error: unknown) => error instanceof WebSearchUnavailableError && error.code === WEB_SEARCH_UNAVAILABLE,
    );
  });

  test("HTTP 503 and missing adapter return WEB_SEARCH_UNAVAILABLE with no data", async () => {
    const missing = await WebSearchService.search({ query: "news" }, { baseUrl: "" });
    assert.equal(missing.ok, false);
    if (!missing.ok) {
      assert.equal(missing.code, WEB_SEARCH_UNAVAILABLE);
      assert.equal(missing.message, WEB_SEARCH_UNAVAILABLE_MESSAGE);
    }

    const { fetchFn } = recordingFetch(async () => jsonResponse({ results: [] }, 503));
    const down = await WebSearchService.search(
      { query: "news" },
      { baseUrl: CONFIGURED, fetchImpl: fetchFn as typeof fetch },
    );
    assert.equal(down.ok, false);
    if (!down.ok) {
      assert.equal(down.code, WEB_SEARCH_UNAVAILABLE);
      assert.equal("data" in down, false);
    }
  });
});
