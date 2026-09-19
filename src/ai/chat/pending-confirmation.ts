import "server-only";

import type { RequestContext } from "@mastra/core/request-context";

import type { ChatSseConfirmationRequired } from "@/ai/chat/sse";
import { isConfirmationRequiredResult, type ToolResult } from "@/ai/result";

/**
 * RequestContext slot for the operator SSE card. The model-visible tool result
 * has confirmToken stripped; the UI receives the opaque token only here.
 */
export const VERSATECH_AI_PENDING_CONFIRMATION_KEY = "versatechPendingConfirmation";

function isSseConfirmation(value: unknown): value is ChatSseConfirmationRequired {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    record.type === "confirmation_required" &&
    typeof record.actionId === "string" &&
    record.actionId.length > 0 &&
    typeof record.toolName === "string" &&
    record.toolName.length > 0 &&
    typeof record.humanSummary === "string" &&
    record.humanSummary.length > 0 &&
    typeof record.expiresAt === "string" &&
    record.expiresAt.length > 0 &&
    typeof record.token === "string" &&
    record.token.length > 0
  );
}

function toSseConfirmation(result: ToolResult): ChatSseConfirmationRequired | null {
  if (!isConfirmationRequiredResult(result)) {
    return null;
  }
  const token = result.proposal.confirmToken || result.proposal.token;
  if (
    !token ||
    !result.proposal.actionId ||
    !result.proposal.humanSummary ||
    !result.proposal.expiresAt
  ) {
    return null;
  }
  return {
    type: "confirmation_required",
    actionId: result.proposal.actionId,
    toolName: result.proposal.toolName,
    humanSummary: result.proposal.humanSummary,
    expiresAt: result.proposal.expiresAt,
    token,
  };
}

/** Keep the signed token off the model; stash it for the chat SSE frame. */
export function stashPendingConfirmation(
  requestContext: RequestContext | undefined,
  result: ToolResult,
): void {
  if (!requestContext) {
    return;
  }
  const event = toSseConfirmation(result);
  if (!event) {
    return;
  }
  requestContext.setRaw(VERSATECH_AI_PENDING_CONFIRMATION_KEY, event);
}

/** Single read for the SSE layer. Does not execute the WRITE. */
export function takePendingConfirmation(
  requestContext: RequestContext | undefined,
): ChatSseConfirmationRequired | null {
  if (!requestContext) {
    return null;
  }
  const raw = requestContext.getRaw(VERSATECH_AI_PENDING_CONFIRMATION_KEY);
  if (!isSseConfirmation(raw)) {
    return null;
  }
  requestContext.setRaw(VERSATECH_AI_PENDING_CONFIRMATION_KEY, null);
  return raw;
}
