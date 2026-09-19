import "server-only";

import { parisDateKey } from "@/lib/dates";
import {
  isConfirmableWriteTool,
  type ConfirmableWriteToolName,
} from "@/ai/permissions/catalog";
import { getToolPermission } from "@/ai/permissions";
import {
  completeFollowUpInputSchema,
  createFollowUpInputSchema,
  createTaskInputSchema,
} from "@/ai/schemas";

export {
  CONFIRMABLE_WRITE_TOOLS as CONFIRMABLE_WRITE_TOOL_NAMES,
  isConfirmableWriteTool as isConfirmableWriteToolName,
  type ConfirmableWriteToolName,
} from "@/ai/permissions/catalog";

export type CreateFollowUpWriteArgs = ReturnType<typeof createFollowUpInputSchema.parse>;
export type CompleteFollowUpWriteArgs = ReturnType<typeof completeFollowUpInputSchema.parse>;
export type CreateTaskWriteArgs = ReturnType<typeof createTaskInputSchema.parse>;

export type ConfirmableWriteArgs =
  | CreateFollowUpWriteArgs
  | CompleteFollowUpWriteArgs
  | CreateTaskWriteArgs;

const WRITE_SCHEMAS = {
  createFollowUp: createFollowUpInputSchema,
  completeFollowUp: completeFollowUpInputSchema,
  createTask: createTaskInputSchema,
} as const;

export function isCriticalToolName(name: string): boolean {
  return getToolPermission(name) === "CRITICAL";
}

export function parseConfirmableWriteArgs(
  toolName: ConfirmableWriteToolName,
  args: unknown,
): { ok: true; args: ConfirmableWriteArgs } | { ok: false } {
  const parsed = WRITE_SCHEMAS[toolName].safeParse(args ?? {});
  if (!parsed.success) {
    return { ok: false };
  }
  return { ok: true, args: parsed.data };
}

function oneLine(value: string, max = 80): string {
  return value.replace(/[\n\r\t]+/g, " ").trim().slice(0, max);
}

export function humanSummaryForWrite(
  toolName: ConfirmableWriteToolName,
  args: ConfirmableWriteArgs,
): string {
  if (toolName === "createFollowUp") {
    const followUp = args as CreateFollowUpWriteArgs;
    const title = followUp.title ? ` « ${oneLine(followUp.title, 40)} »` : "";
    const civil = parisDateKey(followUp.dueAt);
    return `Relance${title} — civil ${civil} — ${followUp.dueAt}`;
  }
  if (toolName === "completeFollowUp") {
    return "Terminer la relance.";
  }
  const task = args as CreateTaskWriteArgs;
  if (task.dueAt) {
    return `Tâche « ${oneLine(task.title, 40)} » — civil ${parisDateKey(task.dueAt)} — ${task.dueAt}`;
  }
  return `Tâche « ${oneLine(task.title, 40)} ».`;
}

export { isConfirmableWriteTool };
