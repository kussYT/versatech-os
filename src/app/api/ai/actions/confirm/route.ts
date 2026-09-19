import "server-only";

import { NextResponse } from "next/server";

import {
  CONFIRM_ERROR_MESSAGES,
  handleConfirmActionRequest,
} from "@/ai/confirmation";
import { requireRequestActor } from "@/lib/auth/request-actor";
import { logServerError } from "@/lib/observability/log-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Authenticated WRITE confirmation. Session required; never a public API path.
 * POST only. Body is `{ token }` — never execute `{ toolName, args }` from
 * the client. The LLM cannot confirm. Replay uses `claimAiActionConsumption`.
 */
export async function POST(request: Request) {
  const actorResult = await requireRequestActor();
  if (!actorResult.ok) {
    return NextResponse.json({ error: CONFIRM_ERROR_MESSAGES.AUTH_REQUIRED }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: CONFIRM_ERROR_MESSAGES.INVALID_REQUEST }, { status: 400 });
  }

  try {
    const result = await handleConfirmActionRequest({
      actor: actorResult.actor,
      body,
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    logServerError("ai.actions.confirm", error);
    return NextResponse.json({ error: CONFIRM_ERROR_MESSAGES.UNAVAILABLE }, { status: 500 });
  }
}
