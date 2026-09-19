import "server-only";

import type { ToolRuntime } from "@/ai/context";
import { writeProposalSchema, type WriteProposal } from "@/ai/confirmation/types";
import {
  getToolPermission,
  isConfirmableWriteTool,
  type ConfirmableWriteToolName,
} from "@/ai/permissions";
import { isSafeToolMessage, toolFailure, toolSuccess, type ToolResult } from "@/ai/result";
import type { CompleteFollowUpInput } from "@/ai/schemas/complete-follow-up";
import type { CreateFollowUpInput } from "@/ai/schemas/create-follow-up";
import type { CreateTaskInput } from "@/ai/schemas/create-task";
import {
  completeFollowUpInputSchema,
  createFollowUpInputSchema,
  createTaskInputSchema,
} from "@/ai/schemas";
import type {
  CompleteFollowUpInput as CompleteFollowUpServiceInput,
  CreateFollowUpInput as CreateFollowUpServiceInput,
} from "@/lib/services/follow-ups/write";
import type { CreateTaskInput as CreateTaskServiceInput } from "@/lib/services/tasks/write";
import type { ServiceResult } from "@/lib/services/_shared/result";
import {
  COMPANY_NOT_FOUND_MESSAGE,
  FOLLOW_UP_NOT_FOUND_MESSAGE,
  isCompanyNotFoundError,
  isFollowUpNotFoundError,
  isProjectNotFoundError,
  PROJECT_NOT_FOUND_MESSAGE,
} from "./service-errors";

const AI_SOURCE = "ai" as const;

export type CreateFollowUpFn = (input: CreateFollowUpServiceInput) => Promise<unknown>;

export type CompleteFollowUpFn = (input: CompleteFollowUpServiceInput) => Promise<unknown>;

export type CreateTaskFn = (input: CreateTaskServiceInput) => Promise<unknown>;

export type ConfirmedWriteDeps = {
  createFollowUp?: CreateFollowUpFn;
  completeFollowUp?: CompleteFollowUpFn;
  createTask?: CreateTaskFn;
  /** Opaque `Prisma.TransactionClient` from `runConfirmedWrite`. No Prisma import here. */
  tx?: unknown;
};

async function defaultCreateFollowUp(input: CreateFollowUpServiceInput, tx?: unknown) {
  const { FollowUpService } = await import("@/lib/services/follow-ups");
  if (typeof FollowUpService.createFollowUp !== "function") {
    throw new Error("SERVICE_UNAVAILABLE");
  }
  return FollowUpService.createFollowUp(input, tx ? { tx: tx as never } : {});
}

async function defaultCompleteFollowUp(input: CompleteFollowUpServiceInput, tx?: unknown) {
  const { FollowUpService } = await import("@/lib/services/follow-ups");
  if (typeof FollowUpService.completeFollowUp !== "function") {
    throw new Error("SERVICE_UNAVAILABLE");
  }
  return FollowUpService.completeFollowUp(input, tx ? { tx: tx as never } : {});
}

async function defaultCreateTask(input: CreateTaskServiceInput, tx?: unknown) {
  const { TaskService } = await import("@/lib/services/tasks");
  if (typeof TaskService.createTask !== "function") {
    throw new Error("SERVICE_UNAVAILABLE");
  }
  return TaskService.createTask(input, tx ? { tx: tx as never } : {});
}

function isServiceResult(value: unknown): value is ServiceResult<Record<string, unknown>> {
  return Boolean(value && typeof value === "object" && "ok" in value);
}

function unwrapMutationPayload(value: unknown): Record<string, unknown> {
  if (isServiceResult(value)) {
    if (!value.ok) {
      const error = new Error(value.message);
      (error as Error & { serviceCode?: string }).serviceCode = value.code;
      throw error;
    }
    if (!value.data || typeof value.data !== "object") {
      throw new Error("SERVICE_UNAVAILABLE");
    }
    return value.data as Record<string, unknown>;
  }
  if (!value || typeof value !== "object") {
    throw new Error("INTERNAL");
  }
  return value as Record<string, unknown>;
}

function requireId(payload: Record<string, unknown>, key: string): string {
  const id = payload[key];
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("INTERNAL");
  }
  return id;
}

function mapMutationError(error: unknown): ToolResult<never> {
  const serviceCode =
    error instanceof Error ? (error as Error & { serviceCode?: string }).serviceCode : undefined;
  const message = error instanceof Error ? error.message : undefined;

  if (message === "SERVICE_UNAVAILABLE") {
    return toolFailure("SERVICE_UNAVAILABLE");
  }
  if (serviceCode === "AUTH_REQUIRED") {
    return toolFailure("AUTH_REQUIRED");
  }
  if (serviceCode === "NOT_FOUND" || isCompanyNotFoundError(error) || isProjectNotFoundError(error) || isFollowUpNotFoundError(error)) {
    if (isCompanyNotFoundError(error)) {
      return toolFailure("NOT_FOUND", COMPANY_NOT_FOUND_MESSAGE);
    }
    if (isProjectNotFoundError(error)) {
      return toolFailure("NOT_FOUND", PROJECT_NOT_FOUND_MESSAGE);
    }
    if (isFollowUpNotFoundError(error) || message === FOLLOW_UP_NOT_FOUND_MESSAGE) {
      return toolFailure("NOT_FOUND", FOLLOW_UP_NOT_FOUND_MESSAGE);
    }
    return toolFailure("NOT_FOUND", message && isSafeToolMessage(message) ? message : undefined);
  }
  if (serviceCode === "VALIDATION" || serviceCode === "CONFLICT") {
    return toolFailure("VALIDATION_FAILED", message && isSafeToolMessage(message) ? message : undefined);
  }
  if (serviceCode === "FORBIDDEN") {
    return toolFailure("FORBIDDEN");
  }
  return toolFailure("INTERNAL");
}

async function runCreateFollowUp(
  runtime: ToolRuntime,
  input: CreateFollowUpInput,
  createFollowUp: CreateFollowUpFn,
): Promise<ToolResult> {
  const payload = unwrapMutationPayload(
    await createFollowUp({
      actor: runtime.actor,
      companyId: input.companyId,
      dueAt: new Date(input.dueAt),
      title: input.title,
      source: AI_SOURCE,
    }),
  );
  return toolSuccess({ followUpId: requireId(payload, "followUpId") });
}

async function runCompleteFollowUp(
  runtime: ToolRuntime,
  input: CompleteFollowUpInput,
  completeFollowUp: CompleteFollowUpFn,
): Promise<ToolResult> {
  const payload = unwrapMutationPayload(
    await completeFollowUp({
      actor: runtime.actor,
      followUpId: input.followUpId,
      source: AI_SOURCE,
    }),
  );
  return toolSuccess({ followUpId: requireId(payload, "followUpId") });
}

async function runCreateTask(
  runtime: ToolRuntime,
  input: CreateTaskInput,
  createTask: CreateTaskFn,
): Promise<ToolResult> {
  const payload = unwrapMutationPayload(
    await createTask({
      actor: runtime.actor,
      title: input.title,
      priority: input.priority,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      projectId: input.projectId,
      companyId: input.companyId,
      source: AI_SOURCE,
    }),
  );
  return toolSuccess({ taskId: requireId(payload, "taskId") });
}

/**
 * Mutation dispatcher used by registry tests and as a service adapter.
 * Production confirm runs `runConfirmedWrite` (claim + métier in one tx).
 * When `deps.tx` is set, default service calls join that transaction.
 */
export async function executeConfirmedWrite(
  runtime: ToolRuntime,
  proposal: WriteProposal | unknown,
  deps: ConfirmedWriteDeps = {},
): Promise<ToolResult> {
  const parsedProposal = writeProposalSchema.safeParse(proposal);
  if (!parsedProposal.success) {
    return toolFailure("VALIDATION_FAILED");
  }

  const { toolName, args, actorId } = parsedProposal.data;
  const permission = getToolPermission(toolName);

  if (permission === undefined) {
    return toolFailure("FORBIDDEN", "Outil inconnu.");
  }
  if (permission === "CRITICAL") {
    return toolFailure("FORBIDDEN", "Les actions critiques ne sont pas disponibles.");
  }
  if (permission !== "WRITE" || !isConfirmableWriteTool(toolName)) {
    return toolFailure("NOT_AVAILABLE");
  }
  if (actorId !== runtime.actor.id) {
    return toolFailure("FORBIDDEN");
  }

  try {
    return await dispatchConfirmedWrite(runtime, toolName, args, deps);
  } catch (error) {
    return mapMutationError(error);
  }
}

async function dispatchConfirmedWrite(
  runtime: ToolRuntime,
  toolName: ConfirmableWriteToolName,
  args: Record<string, unknown>,
  deps: ConfirmedWriteDeps,
): Promise<ToolResult> {
  if (toolName === "createFollowUp") {
    const parsed = createFollowUpInputSchema.safeParse(args);
    if (!parsed.success) {
      return toolFailure("VALIDATION_FAILED");
    }
    return runCreateFollowUp(
      runtime,
      parsed.data,
      deps.createFollowUp ?? ((input) => defaultCreateFollowUp(input, deps.tx)),
    );
  }
  if (toolName === "completeFollowUp") {
    const parsed = completeFollowUpInputSchema.safeParse(args);
    if (!parsed.success) {
      return toolFailure("VALIDATION_FAILED");
    }
    return runCompleteFollowUp(
      runtime,
      parsed.data,
      deps.completeFollowUp ?? ((input) => defaultCompleteFollowUp(input, deps.tx)),
    );
  }

  const parsed = createTaskInputSchema.safeParse(args);
  if (!parsed.success) {
    return toolFailure("VALIDATION_FAILED");
  }
  return runCreateTask(
    runtime,
    parsed.data,
    deps.createTask ?? ((input) => defaultCreateTask(input, deps.tx)),
  );
}
