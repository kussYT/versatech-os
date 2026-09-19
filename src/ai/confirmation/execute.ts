import "server-only";

import { createToolRuntime } from "@/ai/context";
import { isSafeToolMessage, toolFailure, type ToolResult } from "@/ai/result";
import type { SessionUser } from "@/lib/auth/types";
import { AlreadyConsumedError } from "@/lib/services/ai-action-consumption/errors";
import type { RunConfirmedWriteResult } from "@/lib/services/ai-action-consumption/run-confirmed-write";
import type {
  CompleteFollowUpWriteArgs,
  ConfirmableWriteToolName,
  CreateFollowUpWriteArgs,
  CreateTaskWriteArgs,
} from "./tools";

/**
 * Plug point after protocol checks (signature, actor, TTL, allowlist, Zod).
 *
 * Production delegates to `runConfirmedWrite` (lib/services): one PostgreSQL
 * transaction that claims `actionId` then runs FollowUpService / TaskService.
 * Protocol tests inject `deps.execute`.
 *
 * Never read toolName/args from the HTTP body. Never treat `{ confirmed: true }`
 * from the model as proof.
 */
export type ConfirmedWriteInput =
  | {
      actor: SessionUser;
      actionId: string;
      expiresAt: string;
      toolName: "createFollowUp";
      args: CreateFollowUpWriteArgs;
    }
  | {
      actor: SessionUser;
      actionId: string;
      expiresAt: string;
      toolName: "completeFollowUp";
      args: CompleteFollowUpWriteArgs;
    }
  | {
      actor: SessionUser;
      actionId: string;
      expiresAt: string;
      toolName: "createTask";
      args: CreateTaskWriteArgs;
    };

export type ExecuteConfirmedWrite = (input: ConfirmedWriteInput) => Promise<ToolResult>;

function toolResultFromRun(result: RunConfirmedWriteResult): ToolResult {
  if (result.ok) {
    return { success: true, data: result.data };
  }

  if (result.code === "AUTH_REQUIRED") {
    return toolFailure("AUTH_REQUIRED");
  }
  if (result.code === "FORBIDDEN") {
    return toolFailure("FORBIDDEN");
  }
  if (result.code === "NOT_FOUND") {
    return toolFailure(
      "NOT_FOUND",
      isSafeToolMessage(result.message) ? result.message : undefined,
    );
  }
  if (result.code === "VALIDATION" || result.code === "CONFLICT") {
    return toolFailure(
      "VALIDATION_FAILED",
      isSafeToolMessage(result.message) ? result.message : undefined,
    );
  }
  return toolFailure("INTERNAL");
}

export async function executeConfirmedWrite(
  input: ConfirmedWriteInput,
): Promise<ToolResult> {
  const created = createToolRuntime(input.actor, input.actionId);
  if (!created.ok) {
    return toolFailure("AUTH_REQUIRED");
  }

  const { runConfirmedWrite } = await import(
    "@/lib/services/ai-action-consumption/run-confirmed-write"
  );
  const result = await runConfirmedWrite(input);
  if (!result.ok && result.code === "ALREADY_CONSUMED") {
    throw new AlreadyConsumedError(input.actionId);
  }
  return toolResultFromRun(result);
}

export function toConfirmedWriteInput(input: {
  actor: SessionUser;
  actionId: string;
  expiresAt: string;
  toolName: ConfirmableWriteToolName;
  args: ConfirmedWriteInput["args"];
}): ConfirmedWriteInput {
  if (input.toolName === "createFollowUp") {
    return {
      actor: input.actor,
      actionId: input.actionId,
      expiresAt: input.expiresAt,
      toolName: "createFollowUp",
      args: input.args as CreateFollowUpWriteArgs,
    };
  }
  if (input.toolName === "completeFollowUp") {
    return {
      actor: input.actor,
      actionId: input.actionId,
      expiresAt: input.expiresAt,
      toolName: "completeFollowUp",
      args: input.args as CompleteFollowUpWriteArgs,
    };
  }
  return {
    actor: input.actor,
    actionId: input.actionId,
    expiresAt: input.expiresAt,
    toolName: "createTask",
    args: input.args as CreateTaskWriteArgs,
  };
}
