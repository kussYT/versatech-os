import "server-only";

import { NextResponse } from "next/server";

import { takePendingConfirmation } from "@/ai/chat/pending-confirmation";
import { CHAT_ERROR_MESSAGES, isAbortError, prepareVersatechChatRun } from "@/ai/chat/run-chat";
import { chatRequestSchema, toAgentMessages } from "@/ai/chat/schema";
import { createChatSseResponse } from "@/ai/chat/sse";
import { versatechAgent } from "@/ai/index";
import { extractHttpsSourcesFromToolResults } from "@/components/ai/sources";
import { isVersatechAiConfigured } from "@/ai/providers/model";
import { requireRequestActor } from "@/lib/auth/request-actor";
import { logServerError } from "@/lib/observability/log-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Authenticated chat. Session required; never a public API path.
 * No GET, no Mastra catch-all, no redirect on missing session.
 *
 * 200 streams real Mastra `textStream` as SSE (`delta` / `confirmation_required` / `done` / `error`).
 * Additive `status` / `sources` frames may appear; they do not change those shapes.
 * WRITE tools never mutate here — they only stash a signed proposal for the confirm route.
 * `@mastra/ai-sdk` is not in the tree — no AI SDK UI protocol.
 * Auth, validation, and unconfigured provider stay JSON 401/400/503.
 */
export async function POST(request: Request) {
  const actorResult = await requireRequestActor();
  if (!actorResult.ok) {
    return NextResponse.json({ error: CHAT_ERROR_MESSAGES.AUTH_REQUIRED }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: CHAT_ERROR_MESSAGES.INVALID_REQUEST }, { status: 400 });
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: CHAT_ERROR_MESSAGES.INVALID_REQUEST }, { status: 400 });
  }

  const prepared = prepareVersatechChatRun({
    actor: actorResult.actor,
    isConfigured: isVersatechAiConfigured,
  });
  if (!prepared.ok) {
    return NextResponse.json({ error: prepared.error }, { status: prepared.status });
  }

  const messages = toAgentMessages(parsed.data);

  try {
    const output = await versatechAgent.stream(messages, {
      requestContext: prepared.requestContext,
      abortSignal: prepared.abortSignal,
    });

    return createChatSseResponse({
      source: {
        textStream: output.textStream,
        text: output.text,
        toolStream: output.fullStream,
      },
      abortSignal: prepared.abortSignal,
      onFinally: prepared.stopWatchdog,
      getConfirmation: () => takePendingConfirmation(prepared.requestContext),
      getSources: () => extractHttpsSourcesFromToolResults(output._getImmediateToolResults()),
    });
  } catch (error) {
    prepared.stopWatchdog();
    if (prepared.abortSignal.aborted || isAbortError(error)) {
      return NextResponse.json({ error: CHAT_ERROR_MESSAGES.UNAVAILABLE }, { status: 503 });
    }
    logServerError("ai.chat", error);
    return NextResponse.json({ error: CHAT_ERROR_MESSAGES.INTERNAL }, { status: 500 });
  }
}
