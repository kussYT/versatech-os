import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { CHAT_ERROR_MESSAGES } from "@/ai/chat/run-chat";
import { createChatSseResponse, encodeChatSseEvent, chatSseSideEventsFromChunk } from "@/ai/chat/sse";
import { WEB_SEARCH_STATUS_LABEL } from "@/components/ai/sources";

describe("chat SSE", () => {
  test("encodes one JSON event per SSE data frame", () => {
    assert.equal(
      encodeChatSseEvent({ type: "delta", text: "Bonjour\nNord" }),
      `data: ${JSON.stringify({ type: "delta", text: "Bonjour\nNord" })}\n\n`,
    );
  });

  test("encodes confirmation_required without changing delta/done/error shapes", () => {
    const event = {
      type: "confirmation_required" as const,
      actionId: "act_1",
      toolName: "createFollowUp",
      humanSummary: "Planifier une relance.",
      expiresAt: "2026-09-19T10:08:00.000Z",
      token: "opaque.jwt.token",
    };
    assert.equal(encodeChatSseEvent(event), `data: ${JSON.stringify(event)}\n\n`);
    assert.equal(
      encodeChatSseEvent({ type: "done", message: "ok" }),
      `data: ${JSON.stringify({ type: "done", message: "ok" })}\n\n`,
    );
    assert.equal(
      encodeChatSseEvent({ type: "error", error: "x" }),
      `data: ${JSON.stringify({ type: "error", error: "x" })}\n\n`,
    );
  });

  test("emits confirmation_required between deltas and done without changing those shapes", async () => {
    async function* textStream() {
      yield "Bon";
      yield "jour";
    }
    const confirmation = {
      type: "confirmation_required" as const,
      actionId: "act_1",
      toolName: "createFollowUp",
      humanSummary: "Planifier une relance.",
      expiresAt: "2026-09-19T10:08:00.000Z",
      token: "opaque.jwt.token",
    };
    const response = createChatSseResponse({
      source: { textStream: textStream(), text: Promise.resolve("Bonjour") },
      abortSignal: new AbortController().signal,
      getConfirmation: () => confirmation,
    });
    const body = await response.text();
    assert.equal(
      body,
      `${encodeChatSseEvent({ type: "delta", text: "Bon" })}${encodeChatSseEvent({
        type: "delta",
        text: "jour",
      })}${encodeChatSseEvent(confirmation)}${encodeChatSseEvent({
        type: "done",
        message: "Bonjour",
      })}`,
    );
  });

  test("forwards real textStream chunks then a done event", async () => {
    async function* textStream() {
      yield "Bon";
      yield "jour";
    }

    const response = createChatSseResponse({
      source: { textStream: textStream(), text: Promise.resolve("Bonjour") },
      abortSignal: new AbortController().signal,
    });

    assert.equal(response.status, 200);
    assert.match(String(response.headers.get("content-type")), /text\/event-stream/);

    const body = await response.text();
    assert.equal(
      body,
      `${encodeChatSseEvent({ type: "delta", text: "Bon" })}${encodeChatSseEvent({
        type: "delta",
        text: "jour",
      })}${encodeChatSseEvent({ type: "done", message: "Bonjour" })}`,
    );
  });

  test("forwards Mastra ReadableStream textStream chunks then a done event", async () => {
    const textStream = new ReadableStream<string>({
      start(controller) {
        controller.enqueue("Bon");
        controller.enqueue("jour");
        controller.close();
      },
    });

    const response = createChatSseResponse({
      source: { textStream, text: Promise.resolve("Bonjour") },
      abortSignal: new AbortController().signal,
    });
    const body = await response.text();
    assert.equal(
      body,
      `${encodeChatSseEvent({ type: "delta", text: "Bon" })}${encodeChatSseEvent({
        type: "delta",
        text: "jour",
      })}${encodeChatSseEvent({ type: "done", message: "Bonjour" })}`,
    );
  });

  test("maps stream failures to a generic error event without leaking secrets", async () => {
    async function* textStream() {
      yield "A";
      throw new Error("DATABASE_URL=postgresql://versatech:secret@localhost:5432/versatech_os");
    }

    const response = createChatSseResponse({
      source: { textStream: textStream(), text: Promise.resolve("A") },
      abortSignal: new AbortController().signal,
    });
    const body = await response.text();
    assert.match(body, /"type":"delta"/);
    assert.match(body, /"type":"error"/);
    assert.equal(body.includes("DATABASE_URL"), false);
    assert.equal(body.includes("secret"), false);
    assert.ok(body.includes(CHAT_ERROR_MESSAGES.INTERNAL));
  });

  test("maps abort to the unavailable error event", async () => {
    const controller = new AbortController();
    controller.abort();
    async function* textStream() {
      yield "nope";
    }

    const response = createChatSseResponse({
      source: { textStream: textStream(), text: "nope" },
      abortSignal: controller.signal,
    });
    const body = await response.text();
    assert.equal(body, encodeChatSseEvent({ type: "error", error: CHAT_ERROR_MESSAGES.UNAVAILABLE }));
  });

  test("encodes additive status and sources without changing delta/done/error shapes", () => {
    assert.equal(
      encodeChatSseEvent({ type: "status", label: WEB_SEARCH_STATUS_LABEL }),
      `data: ${JSON.stringify({ type: "status", label: WEB_SEARCH_STATUS_LABEL })}\n\n`,
    );
    assert.equal(
      encodeChatSseEvent({
        type: "sources",
        sources: [{ url: "https://nord-industrie.example", title: "Nord" }],
      }),
      `data: ${JSON.stringify({
        type: "sources",
        sources: [{ url: "https://nord-industrie.example", title: "Nord" }],
      })}\n\n`,
    );
    assert.equal(
      encodeChatSseEvent({ type: "done", message: "ok" }),
      `data: ${JSON.stringify({ type: "done", message: "ok" })}\n\n`,
    );
  });

  test("emits sources after deltas when getSources returns https URLs, never SearXNG", async () => {
    async function* textStream() {
      yield "Nord";
    }
    const response = createChatSseResponse({
      source: { textStream: textStream(), text: Promise.resolve("Nord") },
      abortSignal: new AbortController().signal,
      getSources: () => [
        { url: "https://nord-industrie.example", title: "Nord" },
        { url: "https://searxng.local/search", title: "SearXNG" },
      ],
    });
    const body = await response.text();
    assert.equal(
      body,
      `${encodeChatSseEvent({ type: "delta", text: "Nord" })}${encodeChatSseEvent({
        type: "sources",
        sources: [{ url: "https://nord-industrie.example", title: "Nord" }],
      })}${encodeChatSseEvent({ type: "done", message: "Nord" })}`,
    );
    assert.equal(body.includes("SearXNG"), false);
  });

  test("emits Recherche sur le Web… from a webSearch tool-call chunk", async () => {
    async function* textStream() {
      yield "ok";
    }
    async function* toolStream() {
      yield {
        type: "tool-call",
        payload: { toolName: "webSearch", args: { query: "Nord" } },
      };
      yield {
        type: "tool-result",
        payload: {
          toolName: "webSearch",
          result: { results: [{ url: "https://nord.example", title: "Nord" }] },
        },
      };
    }
    const response = createChatSseResponse({
      source: {
        textStream: textStream(),
        text: Promise.resolve("ok"),
        toolStream: toolStream(),
      },
      abortSignal: new AbortController().signal,
    });
    const body = await response.text();
    assert.match(body, /"type":"status"/);
    assert.match(body, /Recherche sur le Web/);
    assert.equal(body.includes("webSearch"), false);
    assert.equal(body.includes("SearXNG"), false);
    assert.match(body, /"type":"sources"/);
    assert.match(body, /https:\/\/nord\.example/);
  });

  test("side-channel mapper ignores CRM tools and drops SearXNG urls", () => {
    const crm = chatSseSideEventsFromChunk({
      type: "tool-call",
      payload: { toolName: "searchCompanies" },
    });
    assert.deepEqual(crm, []);
    const web = chatSseSideEventsFromChunk({
      type: "tool-call",
      payload: { toolName: "webSearch" },
    });
    assert.deepEqual(web, [{ type: "status", label: WEB_SEARCH_STATUS_LABEL }]);
  });
});
