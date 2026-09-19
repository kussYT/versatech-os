import "server-only";

import type { RequestContext } from "@mastra/core/request-context";

import { isConfirmableWriteTool, WRITE_CONFIRMABLE_MAX_PER_TURN } from "@/ai/permissions";
import { toolFailure, type ToolResult } from "@/ai/result";

/**
 * Hard READ tool-call ceiling per chat request (orchestrator, not prompt).
 * One LLM step may call several tools; this counts actual execute attempts.
 */
export const CHAT_MAX_TOOL_CALLS = 6;

/**
 * Hard `webSearch` ceiling per chat request (orchestrator, not prompt).
 * Counts the tool name {@link WEB_SEARCH_TOOL_NAME} only — not query text.
 */
export const CHAT_MAX_WEB_SEARCH_CALLS = 2;

export const WEB_SEARCH_TOOL_NAME = "webSearch";

/**
 * Mastra LLM-step ceiling: enough for {@link CHAT_MAX_TOOL_CALLS} sequential
 * tool rounds plus a final answer. The tool-call guard is the hard cap.
 */
export const CHAT_MAX_STEPS = 7;

export const VERSATECH_AI_TOOL_GUARD_CONTEXT_KEY = "versatechToolGuard";

export const TOOL_CALL_LIMIT_MESSAGE = "Limite d'outils atteinte.";
export const TOOL_CALL_LOOP_MESSAGE = "Boucle d'outil détectée.";
export const WRITE_CHAIN_MESSAGE = "Une seule mutation peut être proposée à la fois.";
export const WEB_SEARCH_LIMIT_MESSAGE = "Limite de recherches web atteinte.";

export type ToolCallLimitReason = "limit" | "loop" | "write-chain" | "web-search";

export function isWebSearchTool(name: string): boolean {
  return name === WEB_SEARCH_TOOL_NAME;
}

export type ToolCallDecision =
  | { ok: true }
  | { ok: false; reason: ToolCallLimitReason; message: string };

export class ToolCallGuard {
  #count = 0;
  #writeCount = 0;
  #webSearchCount = 0;
  #lastFingerprint: string | undefined;

  get count(): number {
    return this.#count;
  }

  get writeCount(): number {
    return this.#writeCount;
  }

  get webSearchCount(): number {
    return this.#webSearchCount;
  }

  inspect(toolName: string, input: unknown): ToolCallDecision {
    const fingerprint = toolCallFingerprint(toolName, input);
    if (this.#lastFingerprint === fingerprint) {
      return { ok: false, reason: "loop", message: TOOL_CALL_LOOP_MESSAGE };
    }
    if (this.#count >= CHAT_MAX_TOOL_CALLS) {
      return { ok: false, reason: "limit", message: TOOL_CALL_LIMIT_MESSAGE };
    }
    if (isConfirmableWriteTool(toolName) && this.#writeCount >= WRITE_CONFIRMABLE_MAX_PER_TURN) {
      return { ok: false, reason: "write-chain", message: WRITE_CHAIN_MESSAGE };
    }
    if (isWebSearchTool(toolName) && this.#webSearchCount >= CHAT_MAX_WEB_SEARCH_CALLS) {
      return { ok: false, reason: "web-search", message: WEB_SEARCH_LIMIT_MESSAGE };
    }
    this.#lastFingerprint = fingerprint;
    this.#count += 1;
    if (isConfirmableWriteTool(toolName)) {
      this.#writeCount += 1;
    }
    if (isWebSearchTool(toolName)) {
      this.#webSearchCount += 1;
    }
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
