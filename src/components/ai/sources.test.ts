import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  consumeEventStream,
  safeClientError,
  tokenFromSseData,
  tokensFromSseData,
} from "@/components/ai/chat-client";
import {
  extractHttpsSources,
  extractHttpsSourcesFromMarkdown,
  extractHttpsSourcesFromToolResults,
  isPublicHttpUrl,
  parseSourcesPayload,
  parseStatusPayload,
  WEB_SEARCH_STATUS_LABEL,
  WEB_SEARCH_UNAVAILABLE_MESSAGE,
} from "@/components/ai/sources";

const WEB_DTO = {
  success: true,
  data: {
    query: "Nord Industrie Valenciennes",
    results: [
      {
        title: "Nord Industrie",
        url: "https://nord-industrie.example/site",
        snippet: "Site vitrine.",
      },
      {
        title: "PagesJaunes",
        url: "https://www.pagesjaunes.fr/nord-industrie",
        snippet: "Fiche annuaire.",
      },
    ],
  },
};

describe("sources Web Jarvis", () => {
  test("extracts https URLs from a webSearch DTO and ignores CRM search hits", () => {
    const sources = extractHttpsSources(WEB_DTO);
    assert.deepEqual(
      sources.map((item) => item.url),
      ["https://nord-industrie.example/site", "https://www.pagesjaunes.fr/nord-industrie"],
    );
    assert.equal(sources[0]?.title, "Nord Industrie");

    const crm = extractHttpsSourcesFromToolResults({
      toolName: "searchCompanies",
      result: {
        query: "Nord",
        total: 1,
        items: [{ id: "co_1", name: "Nord", lifecycleStatus: "LEAD", website: "https://crm.example" }],
      },
    });
    assert.deepEqual(crm, []);
  });

  test("keeps only the last webSearch tool result and drops SearXNG / javascript", () => {
    const sources = extractHttpsSourcesFromToolResults([
      {
        type: "tool-result",
        payload: {
          toolName: "webSearch",
          result: { results: [{ url: "https://old.example", title: "Old" }] },
        },
      },
      {
        type: "tool-result",
        payload: {
          toolName: "webSearch",
          result: {
            results: [
              { url: "https://fresh.example/a", title: "Fresh" },
              { url: "https://searxng.local/search", title: "SearXNG" },
              { url: "javascript:alert(1)", title: "xss" },
            ],
          },
        },
      },
    ]);
    assert.deepEqual(
      sources.map((item) => item.url),
      ["https://fresh.example/a"],
    );
    assert.equal(
      sources.some((item) => /searxng/i.test(item.url) || /searxng/i.test(item.title ?? "")),
      false,
    );
    assert.equal(isPublicHttpUrl("javascript:alert(1)"), false);
  });

  test("parses markdown links as a fallback and maps webSearch SSE to the French status", () => {
    const fromMarkdown = extractHttpsSourcesFromMarkdown(
      "Voir [Nord](https://nord-industrie.example) et https://pagesjaunes.fr/x.",
    );
    assert.equal(fromMarkdown[0]?.url, "https://nord-industrie.example");
    assert.equal(fromMarkdown[0]?.title, "Nord");

    assert.deepEqual(parseStatusPayload({ type: "status", label: WEB_SEARCH_STATUS_LABEL }), {
      label: WEB_SEARCH_STATUS_LABEL,
    });
    assert.deepEqual(parseStatusPayload({ type: "tool", name: "webSearch" }), {
      label: WEB_SEARCH_STATUS_LABEL,
    });
    assert.deepEqual(parseStatusPayload({ searching: true }), { label: WEB_SEARCH_STATUS_LABEL });
    assert.equal(parseStatusPayload({ type: "tool-call", name: "searchCompanies" }), null);
    assert.equal(
      parseStatusPayload({
        type: "confirmation_required",
        toolName: "createFollowUp",
        searching: true,
      }),
      null,
    );

    const sourceToken = tokensFromSseData(
      JSON.stringify({
        type: "sources",
        sources: [{ url: "https://nord-industrie.example", title: "Nord" }],
      }),
    );
    assert.equal(sourceToken.some((token) => token.kind === "sources"), true);

    assert.equal(tokenFromSseData('{"toolName":"getTodayOverview"}').kind, "skip");
    assert.equal(tokenFromSseData('{"type":"tool-call","name":"listFollowUps"}').kind, "skip");
    const webToken = tokenFromSseData('{"type":"tool","name":"webSearch"}');
    assert.equal(webToken.kind, "status");
    if (webToken.kind === "status") {
      assert.equal(webToken.label, WEB_SEARCH_STATUS_LABEL);
      assert.equal(webToken.label.includes("webSearch"), false);
    }
  });

  test("maps SearXNG / stack web errors to a safe French message", () => {
    assert.equal(safeClientError("SearXNG ECONNREFUSED at 127.0.0.1\n    at fetch"), WEB_SEARCH_UNAVAILABLE_MESSAGE);
    assert.equal(safeClientError("webSearch timeout"), WEB_SEARCH_UNAVAILABLE_MESSAGE);
    assert.equal(WEB_SEARCH_UNAVAILABLE_MESSAGE.includes("SearXNG"), false);
    assert.deepEqual(parseSourcesPayload({ type: "confirmation_required", sources: [{ url: "https://x.example" }] }), []);
  });

  test("consumeEventStream collects sources without duplicating done text", async () => {
    const body = [
      `data: ${JSON.stringify({ type: "status", label: WEB_SEARCH_STATUS_LABEL })}\n\n`,
      `data: ${JSON.stringify({ type: "delta", text: "Nord a un site." })}\n\n`,
      `data: ${JSON.stringify({
        type: "sources",
        sources: [{ url: "https://nord-industrie.example", title: "Nord" }],
      })}\n\n`,
      `data: ${JSON.stringify({ type: "done", message: "Nord a un site." })}\n\n`,
    ].join("");
    const labels: string[] = [];
    const streamed = await consumeEventStream(
      new Response(body, { headers: { "Content-Type": "text/event-stream" } }),
      () => {},
      {
        onStatus: (label) => {
          labels.push(label);
        },
      },
    );
    assert.equal(streamed.text, "Nord a un site.");
    assert.equal(streamed.sources[0]?.url, "https://nord-industrie.example");
    assert.deepEqual(labels, [WEB_SEARCH_STATUS_LABEL]);
  });
});
