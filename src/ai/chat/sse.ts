import "server-only";

import { CHAT_ERROR_MESSAGES, isAbortError } from "@/ai/chat/run-chat";
import { logServerError } from "@/lib/observability/log-error";

export const CHAT_SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;

export type ChatSseEvent =
  | { type: "delta"; text: string }
  | { type: "done"; message: string }
  | { type: "error"; error: string };

export type ChatTextStreamSource = {
  /** Mastra `textStream` is a `ReadableStream<string>`; tests may pass an async iterable. */
  textStream: AsyncIterable<string> | ReadableStream<string>;
  text: Promise<string> | string;
};

function isReadableTextStream(
  stream: ChatTextStreamSource["textStream"],
): stream is ReadableStream<string> {
  return typeof (stream as ReadableStream<string>).getReader === "function";
}

/** Incremental text chunks from Mastra or a test async iterable. */
export async function* iterateChatTextStream(
  stream: ChatTextStreamSource["textStream"],
): AsyncGenerator<string, void, undefined> {
  if (isReadableTextStream(stream)) {
    const reader = stream.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          return;
        }
        yield value;
      }
    } finally {
      reader.releaseLock();
    }
  }

  yield* stream;
}

export function encodeChatSseEvent(event: ChatSseEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * Real SSE from Mastra `textStream` chunks. Never slices a completed generate().
 */
export function createChatSseResponse(input: {
  source: ChatTextStreamSource;
  abortSignal: AbortSignal;
  onFinally?: () => void;
}): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: ChatSseEvent) => {
        controller.enqueue(encoder.encode(encodeChatSseEvent(event)));
      };

      try {
        if (input.abortSignal.aborted) {
          send({ type: "error", error: CHAT_ERROR_MESSAGES.UNAVAILABLE });
          return;
        }

        for await (const chunk of iterateChatTextStream(input.source.textStream)) {
          if (input.abortSignal.aborted) {
            send({ type: "error", error: CHAT_ERROR_MESSAGES.UNAVAILABLE });
            return;
          }
          if (chunk.length > 0) {
            send({ type: "delta", text: chunk });
          }
        }

        const message = await Promise.resolve(input.source.text);
        send({ type: "done", message });
      } catch (error) {
        const aborted = input.abortSignal.aborted || isAbortError(error);
        if (!aborted) {
          logServerError("ai.chat.stream", error);
        }
        try {
          send({
            type: "error",
            error: aborted ? CHAT_ERROR_MESSAGES.UNAVAILABLE : CHAT_ERROR_MESSAGES.INTERNAL,
          });
        } catch {
          // Client disconnected after headers were sent.
        }
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed.
        }
        input.onFinally?.();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: CHAT_SSE_HEADERS,
  });
}
