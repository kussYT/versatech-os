import "server-only";

import type { RequestContext } from "@mastra/core/request-context";

import { toolFailure, type ToolResult } from "@/ai/result";

/**
 * Hard READ tool-call ceiling per chat request (orchestrator, not prompt).
 * One LLM step may call several tools; this counts actual execute attempts.
 */
export const CHAT_MAX_TOOL_CALLS = 6;

/**
 * Mastra LLM-step ceiling: enough for {@link CHAT_MAX_TOOL_CALLS} sequential
 * tool rounds plus a final answer. The tool-call guard is the hard cap.
 */
export const CHAT_MAX_STEPS = 7;

export const VERSATECH_AI_TOOL_GUARD_CONTEXT_KEY = "versatechToolGuard";

export const TOOL_CALL_LIMIT_MESSAGE = "Limite d'outils atteinte.";
export const TOOL_CALL_LOOP_MESSAGE = "Boucle d'outil détectée.";

export type ToolCallLimitReason = "limit" | "loop";

export type ToolCallDecision =
  | { ok: true }
  | { ok: false; reason: ToolCallLimitReason; message: string };

export class ToolCallGuard {
  #count = 0;
  #lastFingerprint: string | undefined;

  get count(): number {
    return this.#count;
  }

  inspect(toolName: string, input: unknown): ToolCallDecision {
    const fingerprint = toolCallFingerprint(toolName, input);
    if (this.#lastFingerprint === fingerprint) {
      return { ok: false, reason: "loop", message: TOOL_CALL_LOOP_MESSAGE };
    }
    if (this.#count >= CHAT_MAX_TOOL_CALLS) {
      return { ok: false, reason: "limit", message: TOOL_CALL_LIMIT_MESSAGE };
    }
    this.#lastFingerprint = fingerprint;
    this.#count += 1;
    return { ok: true };
  }
}

export function toolCallFingerprint(toolName: string, input: unknown): string {
  return `${toolName}:${stableJson(input ?? {})}`;
}

export function getOrCreateToolCallGuard(requestContext: RequestContext): ToolCallGuard {
  const existing = requestContext.getRaw(VERSATECH_AI_TOOL_GUARD_CONTEXT_KEY);
  if (existing instanceof ToolCallGuard) {
    return existing;
  }
  const guard = new ToolCallGuard();
  requestContext.setRaw(VERSATECH_AI_TOOL_GUARD_CONTEXT_KEY, guard);
  return guard;
}

export function requestContextFromToolContext(context: unknown): RequestContext | undefined {
  if (!context || typeof context !== "object") {
    return undefined;
  }
  const requestContext = (context as { requestContext?: unknown }).requestContext;
  if (!requestContext || typeof requestContext !== "object") {
    return undefined;
  }
  if (typeof (requestContext as RequestContext).getRaw !== "function") {
    return undefined;
  }
  return requestContext as RequestContext;
}

/**
 * Fail-closed gate for Mastra `beforeToolCall`. Returns a ToolResult to skip
 * execution, or `null` to proceed.
 */
export function refuseToolCallIfLimited(
  requestContext: RequestContext | undefined,
  toolName: string,
  input: unknown,
): ToolResult<never> | null {
  if (!requestContext) {
    return toolFailure("FORBIDDEN");
  }
  const decision = getOrCreateToolCallGuard(requestContext).inspect(toolName, input);
  if (decision.ok) {
    return null;
  }
  return toolFailure("FORBIDDEN", decision.message);
}

function stableJson(value: unknown): string {
  try {
    return JSON.stringify(value, stableJsonReplacer) ?? "null";
  } catch {
    return "unserializable";
  }
}

function stableJsonReplacer(_key: string, value: unknown): unknown {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((name) => [name, record[name]]),
    );
  }
  return value;
}
