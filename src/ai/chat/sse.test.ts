import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { CHAT_ERROR_MESSAGES } from "@/ai/chat/run-chat";
import { createChatSseResponse, encodeChatSseEvent } from "@/ai/chat/sse";

describe("chat SSE", () => {
  test("encodes one JSON event per SSE data frame", () => {
    assert.equal(
      encodeChatSseEvent({ type: "delta", text: "Bonjour\nNord" }),
      `data: ${JSON.stringify({ type: "delta", text: "Bonjour\nNord" })}\n\n`,
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
});
