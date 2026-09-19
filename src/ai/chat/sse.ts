import "server-only";

import { CHAT_ERROR_MESSAGES, isAbortError } from "@/ai/chat/run-chat";
import {
  extractHttpsSourcesFromToolResults,
  parseStatusPayload,
  WEB_SEARCH_UNAVAILABLE_MESSAGE,
  type ChatSourceLink,
} from "@/components/ai/sources";
import { logServerError } from "@/lib/observability/log-error";

export const CHAT_SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;

export type ChatSseConfirmationRequired = {
  type: "confirmation_required";
  actionId: string;
  toolName: string;
  humanSummary: string;
  expiresAt: string;
  token: string;
};

export type ChatSseStatus = {
  type: "status";
  label: string;
};

export type ChatSseTool = {
  type: "tool";
  name: string;
};

export type ChatSseSources = {
  type: "sources";
  sources: ChatSourceLink[];
};

export type ChatSseEvent =
  | { type: "delta"; text: string }
  | { type: "done"; message: string }
  | { type: "error"; error: string }
  | ChatSseConfirmationRequired
  | ChatSseStatus
  | ChatSseTool
  | ChatSseSources;

export type ChatTextStreamSource = {
  /** Mastra `textStream` is a `ReadableStream<string>`; tests may pass an async iterable. */
  textStream: AsyncIterable<string> | ReadableStream<string>;
  text: Promise<string> | string;
  /**
   * Optional Mastra `fullStream` (or test chunks). Used only for additive
   * `status` / `sources` events — deltas still come from `textStream`.
   */
  toolStream?: AsyncIterable<unknown> | ReadableStream<unknown>;
};

function isReadableStream(
  stream: AsyncIterable<unknown> | ReadableStream<unknown>,
): stream is ReadableStream<unknown> {
  return typeof (stream as ReadableStream<unknown>).getReader === "function";
}

/** Incremental text chunks from Mastra or a test async iterable. */
export async function* iterateChatTextStream(
  stream: ChatTextStreamSource["textStream"],
): AsyncGenerator<string, void, undefined> {
  if (isReadableStream(stream)) {
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

async function* iterateUnknownStream(
  stream: AsyncIterable<unknown> | ReadableStream<unknown>,
): AsyncGenerator<unknown, void, undefined> {
  if (isReadableStream(stream)) {
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

function readOptionalConfirmation(
  getConfirmation?: () => ChatSseConfirmationRequired | null | undefined,
): ChatSseConfirmationRequired | null {
  if (!getConfirmation) {
    return null;
  }
  try {
    const value = getConfirmation();
    if (
      !value ||
      value.type !== "confirmation_required" ||
      typeof value.token !== "string" ||
      value.token.length === 0 ||
      typeof value.actionId !== "string" ||
      value.actionId.length === 0 ||
      typeof value.toolName !== "string" ||
      typeof value.humanSummary !== "string" ||
      typeof value.expiresAt !== "string"
    ) {
      return null;
    }
    return {
      type: "confirmation_required",
      actionId: value.actionId,
      toolName: value.toolName,
      humanSummary: value.humanSummary,
      expiresAt: value.expiresAt,
      token: value.token,
    };
  } catch {
    return null;
  }
}

function sanitizeSources(sources: ChatSourceLink[] | null | undefined): ChatSourceLink[] {
  if (!sources || sources.length === 0) {
    return [];
  }
  return extractHttpsSourcesFromToolResults({
    toolName: "webSearch",
    result: { results: sources },
  });
}

async function readOptionalSources(
  getSources?: () =>
    | ChatSourceLink[]
    | null
    | undefined
    | Promise<ChatSourceLink[] | null | undefined>,
): Promise<ChatSourceLink[]> {
  if (!getSources) {
    return [];
  }
  try {
    return sanitizeSources(await Promise.resolve(getSources()));
  } catch {
    return [];
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

/** Map a Mastra/fullStream chunk to additive SSE events (never delta/done). */
export function chatSseSideEventsFromChunk(chunk: unknown): ChatSseEvent[] {
  const events: ChatSseEvent[] = [];
  const status = parseStatusPayload(chunk);
  if (status && status.label.length > 0) {
    events.push({ type: "status", label: status.label });
  }
  const sources = extractHttpsSourcesFromToolResults(chunk);
  if (sources.length > 0) {
    events.push({ type: "sources", sources });
  }

  const record = asRecord(chunk);
  const payload = record ? (asRecord(record.payload) ?? record) : null;
  const isError =
    record &&
    (record.type === "tool-error" ||
      record.type === "error" ||
      payload?.isError === true ||
      (typeof payload?.error === "object" && payload.error != null));
  const toolName = String(payload?.toolName ?? record?.toolName ?? record?.name ?? "");
  if (isError && /websearch/i.test(toolName.replace(/[^a-z]/gi, ""))) {
    events.push({ type: "error", error: WEB_SEARCH_UNAVAILABLE_MESSAGE });
  }
  return events;
}

/**
 * Real SSE from Mastra `textStream` chunks. Never slices a completed generate().
 * Optional `confirmation_required`, `status`, and `sources` are sibling events —
 * delta/done/error shapes stay unchanged.
 */
export function createChatSseResponse(input: {
  source: ChatTextStreamSource;
  abortSignal: AbortSignal;
  onFinally?: () => void;
  getConfirmation?: () => ChatSseConfirmationRequired | null | undefined;
  getSources?: () =>
    | ChatSourceLink[]
    | null
    | undefined
    | Promise<ChatSourceLink[] | null | undefined>;
}): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: ChatSseEvent) => {
        controller.enqueue(encoder.encode(encodeChatSseEvent(event)));
      };
      const collected: ChatSourceLink[] = [];

      const consumeToolStream = async () => {
        if (!input.source.toolStream) {
          return;
        }
        try {
          for await (const chunk of iterateUnknownStream(input.source.toolStream)) {
            if (input.abortSignal.aborted) {
              return;
            }
            for (const event of chatSseSideEventsFromChunk(chunk)) {
              if (event.type === "sources") {
                collected.push(...event.sources);
                continue;
              }
              if (event.type === "error") {
                continue;
              }
              send(event);
            }
          }
        } catch {
          // Side channel must not fail the operator text stream.
        }
      };

      try {
        if (input.abortSignal.aborted) {
          send({ type: "error", error: CHAT_ERROR_MESSAGES.UNAVAILABLE });
          return;
        }

        const sideTask = consumeToolStream();

        for await (const chunk of iterateChatTextStream(input.source.textStream)) {
          if (input.abortSignal.aborted) {
            send({ type: "error", error: CHAT_ERROR_MESSAGES.UNAVAILABLE });
            return;
          }
          if (chunk.length > 0) {
            send({ type: "delta", text: chunk });
          }
        }

        await sideTask;

        const confirmation = readOptionalConfirmation(input.getConfirmation);
        if (confirmation) {
          send(confirmation);
        }

        const sources = sanitizeSources([
          ...collected,
          ...(await readOptionalSources(input.getSources)),
        ]);
        if (sources.length > 0) {
          send({ type: "sources", sources });
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
