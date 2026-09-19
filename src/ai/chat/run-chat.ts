import "server-only";

import { RequestContext } from "@mastra/core/request-context";

import { getOrCreateToolCallGuard } from "@/ai/agent/loop-limit";
import { attachVersatechAiActor } from "@/ai/agent/mastra-tools";
import { toAgentMessages, type ChatRequest, type ChatTurn } from "@/ai/chat/schema";
import type { SessionUser } from "@/lib/auth/types";

export const CHAT_TIMEOUT_MS = 45_000;

export { CHAT_MAX_STEPS, CHAT_MAX_TOOL_CALLS } from "@/ai/agent/loop-limit";

export const CHAT_ERROR_MESSAGES = {
  AUTH_REQUIRED: "Authentification requise.",
  INVALID_REQUEST: "Requête invalide.",
  UNAVAILABLE: "Assistant indisponible.",
  INTERNAL: "Une erreur interne est survenue.",
} as const;

export type ChatGenerateFn = (input: {
  message: string;
  messages: ChatTurn[];
  requestContext: RequestContext;
  abortSignal: AbortSignal;
}) => Promise<{ text: string }>;

export type ChatRunSuccess = { ok: true; message: string };

export type ChatRunFailure = {
  ok: false;
  status: 503 | 500;
  error: (typeof CHAT_ERROR_MESSAGES)[keyof typeof CHAT_ERROR_MESSAGES];
};

export type ChatRunResult = ChatRunSuccess | ChatRunFailure;

export type ChatPreparedRun = {
  ok: true;
  requestContext: RequestContext;
  abortSignal: AbortSignal;
  stopWatchdog: () => void;
};

export type RunVersatechChatInput = {
  actor: SessionUser;
  message: string;
  history?: ChatRequest["history"];
  requestId?: string;
  generate: ChatGenerateFn;
  isConfigured?: () => boolean;
  timeoutMs?: number;
};

export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const name = "name" in error ? String(error.name) : "";
  return name === "AbortError" || name === "TimeoutError";
}

export function prepareVersatechChatRun(input: {
  actor: SessionUser;
  requestId?: string;
  isConfigured?: () => boolean;
  timeoutMs?: number;
}): ChatRunFailure | ChatPreparedRun {
  if (input.isConfigured && !input.isConfigured()) {
    return { ok: false, status: 503, error: CHAT_ERROR_MESSAGES.UNAVAILABLE };
  }

  const requestContext = new RequestContext();
  attachVersatechAiActor(requestContext, input.actor, input.requestId ?? crypto.randomUUID());
  getOrCreateToolCallGuard(requestContext);

  const controller = new AbortController();
  const timeoutMs = input.timeoutMs ?? CHAT_TIMEOUT_MS;
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  return {
    ok: true,
    requestContext,
    abortSignal: controller.signal,
    stopWatchdog: () => {
      clearTimeout(timer);
    },
  };
}

export async function runVersatechChat({
  actor,
  message,
  history,
  requestId,
  generate,
  isConfigured,
  timeoutMs = CHAT_TIMEOUT_MS,
}: RunVersatechChatInput): Promise<ChatRunResult> {
  const prepared = prepareVersatechChatRun({
    actor,
    requestId,
    isConfigured,
    timeoutMs,
  });
  if (!prepared.ok) {
    return prepared;
  }

  const messages = toAgentMessages({ message, history });

  try {
    const result = await generate({
      message,
      messages,
      requestContext: prepared.requestContext,
      abortSignal: prepared.abortSignal,
    });
    return { ok: true, message: result.text };
  } catch (error) {
    if (prepared.abortSignal.aborted || isAbortError(error)) {
      return { ok: false, status: 503, error: CHAT_ERROR_MESSAGES.UNAVAILABLE };
    }
    return { ok: false, status: 500, error: CHAT_ERROR_MESSAGES.INTERNAL };
  } finally {
    prepared.stopWatchdog();
  }
}
