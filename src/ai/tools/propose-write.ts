import "server-only";

import { createWriteProposal, type WriteProposal } from "@/ai/confirmation";
import type { ConfirmableWriteToolName } from "@/ai/permissions/catalog";
import type { ToolRuntime } from "@/ai/context";
import { toolConfirmationRequired, toolFailure, type ToolResult } from "@/ai/result";
import type { CompleteFollowUpInput } from "@/ai/schemas/complete-follow-up";
import type { CreateFollowUpInput } from "@/ai/schemas/create-follow-up";
import type { CreateTaskInput } from "@/ai/schemas/create-task";
import { summarizeCompleteFollowUp } from "./complete-follow-up";
import { summarizeCreateFollowUp } from "./create-follow-up";
import { summarizeCreateTask } from "./create-task";

function summarizeWrite(toolName: ConfirmableWriteToolName, args: unknown): string {
  if (toolName === "createFollowUp") {
    return summarizeCreateFollowUp(args as CreateFollowUpInput);
  }
  if (toolName === "completeFollowUp") {
    return summarizeCompleteFollowUp(args as CompleteFollowUpInput);
  }
  return summarizeCreateTask(args as CreateTaskInput);
}

/**
 * LLM WRITE path: proposal only. Never mutates CRM records.
 */
export async function proposeConfirmableWrite(
  runtime: ToolRuntime,
  toolName: ConfirmableWriteToolName,
  args: unknown,
): Promise<ToolResult> {
  try {
    const signed = await createWriteProposal({
      actor: runtime.actor,
      toolName,
      args,
      humanSummary: summarizeWrite(toolName, args),
    });
    if (!signed.ok) {
      return toolFailure(signed.code, signed.message);
    }

    const proposal: WriteProposal = {
      toolName: signed.view.toolName,
      args: signed.args as Record<string, unknown>,
      humanSummary: signed.view.humanSummary,
      actorId: runtime.actor.id,
      requestId: runtime.requestId,
      issuedAt: signed.createdAt,
      expiresAt: signed.view.expiresAt,
      actionId: signed.view.actionId,
      confirmToken: signed.token,
      token: signed.token,
    };
    return toolConfirmationRequired(proposal);
  } catch {
    return toolFailure("INTERNAL");
  }
}
