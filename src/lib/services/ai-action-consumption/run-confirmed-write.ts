import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { SessionUser } from "@/lib/auth/types";
import {
  completeFollowUp,
  createFollowUp,
  type CompleteFollowUpInput,
  type CreateFollowUpInput,
} from "@/lib/services/follow-ups/write";
import { createTask, type CreateTaskInput } from "@/lib/services/tasks/write";
import {
  serviceFail,
  type ServiceErrorCode,
  type ServiceResult,
} from "@/lib/services/_shared/result";
import {
  claimAiActionConsumption,
  type AiActionConsumptionClaimTx,
  type ClaimAiActionConsumptionInput,
} from "./claim";
import { isAlreadyConsumedError } from "./errors";
import {
  AI_ACTION_CONSUMPTION_PURGE_RETENTION_MS,
  purgeExpiredAiActionConsumptions,
} from "./purge";

export type ConfirmedWriteToolName = "createFollowUp" | "completeFollowUp" | "createTask";

export type RunConfirmedWriteInput =
  | {
      actor: SessionUser;
      actionId: string;
      expiresAt: string;
      toolName: "createFollowUp";
      args: { companyId: string; dueAt: string; title?: string };
    }
  | {
      actor: SessionUser;
      actionId: string;
      expiresAt: string;
      toolName: "completeFollowUp";
      args: { followUpId: string };
    }
  | {
      actor: SessionUser;
      actionId: string;
      expiresAt: string;
      toolName: "createTask";
      args: {
        title: string;
        priority?: CreateTaskInput["priority"];
        dueAt?: string;
        projectId?: string;
        companyId?: string;
      };
    };

export type ConfirmedWritePayload = { followUpId: string } | { taskId: string };

export type RunConfirmedWriteSuccess = {
  ok: true;
  data: ConfirmedWritePayload;
};

export type RunConfirmedWriteFailure = {
  ok: false;
  code: ServiceErrorCode | "ALREADY_CONSUMED" | "INTERNAL";
  message: string;
};

export type RunConfirmedWriteResult = RunConfirmedWriteSuccess | RunConfirmedWriteFailure;

/**
 * Interactive Prisma client used for claim + métier in ONE transaction.
 * Duck-typed so unit tests can fake UNIQUE without a live engine.
 */
export type ConfirmedWriteTx = Prisma.TransactionClient | (AiActionConsumptionClaimTx & object);

export type RunConfirmedWriteTransaction = <T>(
  fn: (tx: ConfirmedWriteTx) => Promise<T>,
) => Promise<T>;

export type RunConfirmedWriteDeps = {
  transaction?: RunConfirmedWriteTransaction;
  claim?: (
    tx: AiActionConsumptionClaimTx,
    input: ClaimAiActionConsumptionInput,
  ) => Promise<void>;
  purge?: typeof purgeExpiredAiActionConsumptions;
  now?: Date;
  createFollowUp?: typeof createFollowUp;
  completeFollowUp?: typeof completeFollowUp;
  createTask?: typeof createTask;
};

const CONSUMED_MESSAGE = "Cette action a déjà été confirmée.";
const INTERNAL_MESSAGE = "Une erreur interne est survenue.";

class ConfirmedMetierAbortError extends Error {
  readonly result: Extract<ServiceResult<never>, { ok: false }>;

  constructor(result: Extract<ServiceResult<never>, { ok: false }>) {
    super(result.message);
    this.name = "ConfirmedMetierAbortError";
    this.result = result;
  }
}

async function defaultTransaction<T>(fn: (tx: ConfirmedWriteTx) => Promise<T>): Promise<T> {
  const { prisma } = await import("@/lib/db/prisma");
  return prisma.$transaction((tx) => fn(tx));
}

function asServiceTx(tx: ConfirmedWriteTx): Prisma.TransactionClient {
  return tx as Prisma.TransactionClient;
}

function compactFollowUp(result: Extract<ServiceResult<{ followUpId: string }>, { ok: true }>): {
  followUpId: string;
} {
  return { followUpId: result.data.followUpId };
}

function compactTask(result: Extract<ServiceResult<{ taskId: string }>, { ok: true }>): {
  taskId: string;
} {
  return { taskId: result.data.taskId };
}

async function mutateInTx(
  tx: ConfirmedWriteTx,
  input: RunConfirmedWriteInput,
  deps: RunConfirmedWriteDeps,
): Promise<ServiceResult<ConfirmedWritePayload>> {
  const serviceTx = asServiceTx(tx);

  if (input.toolName === "createFollowUp") {
    const create = deps.createFollowUp ?? createFollowUp;
    const payload: CreateFollowUpInput = {
      actor: input.actor,
      companyId: input.args.companyId,
      dueAt: new Date(input.args.dueAt),
      title: input.args.title,
      source: "ai",
    };
    const result = await create(payload, { tx: serviceTx });
    if (!result.ok) {
      return result;
    }
    return { ok: true, data: compactFollowUp(result) };
  }

  if (input.toolName === "completeFollowUp") {
    const complete = deps.completeFollowUp ?? completeFollowUp;
    const payload: CompleteFollowUpInput = {
      actor: input.actor,
      followUpId: input.args.followUpId,
      source: "ai",
    };
    const result = await complete(payload, { tx: serviceTx });
    if (!result.ok) {
      return result;
    }
    return { ok: true, data: compactFollowUp(result) };
  }

  const create = deps.createTask ?? createTask;
  const payload: CreateTaskInput = {
    actor: input.actor,
    title: input.args.title,
    priority: input.args.priority,
    dueAt: input.args.dueAt ? new Date(input.args.dueAt) : null,
    projectId: input.args.projectId,
    companyId: input.args.companyId,
    source: "ai",
  };
  const result = await create(payload, { tx: serviceTx });
  if (!result.ok) {
    return result;
  }
  return { ok: true, data: compactTask(result) };
}

function schedulePurge(deps: RunConfirmedWriteDeps) {
  const purge = deps.purge ?? purgeExpiredAiActionConsumptions;
  const now = deps.now ?? new Date();
  void purge(now, { ms: AI_ACTION_CONSUMPTION_PURGE_RETENTION_MS }).catch(() => {
    // Opportunistic: the confirm transaction already committed.
  });
}

/**
 * Claim the confirmation nonce then run the métier mutation in the same
 * PostgreSQL transaction.
 *
 * 1. `claimAiActionConsumption` INSERT (UNIQUE actionId)
 * 2. FollowUpService / TaskService mutation + ActivityLog
 *
 * If the métier returns a failure or throws, the transaction rolls back —
 * including the consumption row — so the signed token stays retryable until
 * the jose TTL expires.
 *
 * Unique claim failure is ALREADY_CONSUMED (409). The loser never mutates.
 */
export async function runConfirmedWrite(
  input: RunConfirmedWriteInput,
  deps: RunConfirmedWriteDeps = {},
): Promise<RunConfirmedWriteResult> {
  const actorId = input.actor?.id?.trim();
  if (!actorId) {
    return serviceFail("AUTH_REQUIRED", "Authentification requise.");
  }

  const expiresAt = new Date(input.expiresAt);
  if (!Number.isFinite(expiresAt.getTime())) {
    return { ok: false, code: "INTERNAL", message: INTERNAL_MESSAGE };
  }

  const runTx = deps.transaction ?? defaultTransaction;
  const claim = deps.claim ?? claimAiActionConsumption;

  try {
    const data = await runTx(async (tx) => {
      await claim(tx, {
        actionId: input.actionId,
        actorId,
        toolName: input.toolName,
        expiresAt,
      });

      const result = await mutateInTx(tx, input, deps);
      if (!result.ok) {
        throw new ConfirmedMetierAbortError(result);
      }
      return result.data;
    });

    schedulePurge(deps);
    return { ok: true, data };
  } catch (error) {
    if (isAlreadyConsumedError(error)) {
      return { ok: false, code: "ALREADY_CONSUMED", message: CONSUMED_MESSAGE };
    }
    if (error instanceof ConfirmedMetierAbortError) {
      return { ok: false, code: error.result.code, message: error.result.message };
    }
    return { ok: false, code: "INTERNAL", message: INTERNAL_MESSAGE };
  }
}
