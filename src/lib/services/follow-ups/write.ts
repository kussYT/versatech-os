import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { SessionUser } from "@/lib/auth/types";
import { OPEN_OPPORTUNITY_STAGES } from "@/lib/crm/constants";
import {
  fieldErrorsFromZod,
  serviceFail,
  serviceOk,
  withActivitySource,
  type ActivitySource,
  type ServiceResult,
} from "@/lib/services/_shared/result";
import { decideCompleteFollowUp, resolveFollowUpTitle } from "./write-rules";
import {
  COMPANY_NOT_FOUND_MESSAGE,
  FOLLOW_UP_CREATE_VALIDATION_MESSAGE,
  FOLLOW_UP_NOT_FOUND_MESSAGE,
  completeFollowUpInputSchema,
  createFollowUpInputSchema,
  type FollowUpStatus,
} from "./schema";

export type CreateFollowUpInput = {
  actor: SessionUser;
  companyId: string;
  dueAt: Date;
  title?: string | null;
  source?: ActivitySource;
};

export type CompleteFollowUpInput = {
  actor: SessionUser;
  followUpId: string;
  source?: ActivitySource;
};

export type FollowUpWriteResult = {
  followUpId: string;
  companyId: string;
};

type CompanyPriority = "LOW" | "NORMAL" | "MEDIUM" | "HIGH" | "URGENT";

type FollowUpRow = {
  id: string;
  companyId: string;
  status: FollowUpStatus;
};

export type FollowUpWriteTx = {
  followUp: {
    create: (args: {
      data: {
        companyId: string;
        opportunityId: string | null;
        title: string;
        dueAt: Date;
        status: "PENDING";
        priority: CompanyPriority;
      };
    }) => Promise<{ id: string }>;
    update: (args: {
      where: { id: string };
      data: { status: "COMPLETED"; completedAt: Date };
    }) => Promise<unknown>;
  };
  activityLog: {
    create: (args: {
      data: {
        actorId: string;
        entityType: "FollowUp";
        entityId: string;
        action: string;
        metadata: Record<string, string | number | boolean | null>;
      };
    }) => Promise<unknown>;
  };
};

export type FollowUpWriteStore = {
  company: {
    findUnique: (args: {
      where: { id: string };
      select: { id: true; priority: true };
    }) => Promise<{ id: string; priority: CompanyPriority } | null>;
  };
  opportunity: {
    findFirst: (args: {
      where: { companyId: string; stage: { in: string[] } };
      orderBy: { updatedAt: "desc" };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
  };
  followUp: {
    findUnique: (args: { where: { id: string } }) => Promise<FollowUpRow | null>;
  };
  $transaction: <T>(fn: (tx: FollowUpWriteTx) => Promise<T>) => Promise<T>;
};

export type FollowUpWriteDeps = {
  store?: FollowUpWriteStore;
  now?: Date;
  /**
   * Shared `Prisma.TransactionClient` (AI confirm). When set, reads, mutation
   * and ActivityLog use this client — no nested `$transaction`.
   * UI Server Actions omit `tx`; the service opens its own transaction as today.
   */
  tx?: Prisma.TransactionClient;
};

async function resolveStore(store?: FollowUpWriteStore): Promise<FollowUpWriteStore> {
  if (store) {
    return store;
  }
  const { prisma } = await import("@/lib/db/prisma");
  return prisma as unknown as FollowUpWriteStore;
}

type FollowUpWriteClients = {
  read: Pick<FollowUpWriteStore, "company" | "opportunity" | "followUp">;
  runWrite: <T>(fn: (tx: FollowUpWriteTx) => Promise<T>) => Promise<T>;
};

async function resolveWriteClients(deps: FollowUpWriteDeps): Promise<FollowUpWriteClients> {
  if (deps.tx) {
    const shared = deps.tx as unknown as FollowUpWriteStore & FollowUpWriteTx;
    return {
      read: shared,
      runWrite: (fn) => fn(shared),
    };
  }
  const db = await resolveStore(deps.store);
  return {
    read: db,
    runWrite: (fn) => db.$transaction(fn),
  };
}

function requireActorId(actor: SessionUser | null | undefined): ServiceResult<never> | null {
  if (!actor?.id) {
    return serviceFail("AUTH_REQUIRED", "Authentification requise.");
  }
  return null;
}

/**
 * Planifie une relance PENDING. Rattache la dernière opportunité ouverte.
 * ActivityLog dans la transaction. Pas de FormData / revalidatePath.
 */
export async function createFollowUp(
  input: CreateFollowUpInput,
  deps: FollowUpWriteDeps = {},
): Promise<ServiceResult<FollowUpWriteResult>> {
  const authError = requireActorId(input.actor);
  if (authError) {
    return authError;
  }

  const parsed = createFollowUpInputSchema.safeParse({
    companyId: input.companyId,
    dueAt: input.dueAt,
    title: input.title,
  });
  if (!parsed.success) {
    return serviceFail(
      "VALIDATION",
      FOLLOW_UP_CREATE_VALIDATION_MESSAGE,
      fieldErrorsFromZod(parsed.error),
    );
  }

  const { read, runWrite } = await resolveWriteClients(deps);
  const company = await read.company.findUnique({
    where: { id: parsed.data.companyId },
    select: { id: true, priority: true },
  });
  if (!company) {
    return serviceFail("NOT_FOUND", COMPANY_NOT_FOUND_MESSAGE);
  }

  const title = resolveFollowUpTitle(parsed.data.title);
  const openOpportunity = await read.opportunity.findFirst({
    where: {
      companyId: company.id,
      stage: { in: [...OPEN_OPPORTUNITY_STAGES] },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  const followUp = await runWrite(async (tx) => {
    const created = await tx.followUp.create({
      data: {
        companyId: company.id,
        opportunityId: openOpportunity?.id ?? null,
        title,
        dueAt: parsed.data.dueAt,
        status: "PENDING",
        priority: company.priority,
      },
    });

    await tx.activityLog.create({
      data: {
        actorId: input.actor.id,
        entityType: "FollowUp",
        entityId: created.id,
        action: "followup.created",
        metadata: withActivitySource({ companyId: company.id }, input.source),
      },
    });

    return created;
  });

  return serviceOk({ followUpId: followUp.id, companyId: company.id });
}

/**
 * Termine une relance PENDING (BR-007 `completedAt`). No-op si déjà COMPLETED.
 */
export async function completeFollowUp(
  input: CompleteFollowUpInput,
  deps: FollowUpWriteDeps = {},
): Promise<ServiceResult<FollowUpWriteResult>> {
  const authError = requireActorId(input.actor);
  if (authError) {
    return authError;
  }

  const parsed = completeFollowUpInputSchema.safeParse({
    followUpId: input.followUpId,
  });
  if (!parsed.success) {
    return serviceFail("NOT_FOUND", FOLLOW_UP_NOT_FOUND_MESSAGE, fieldErrorsFromZod(parsed.error));
  }

  const { read, runWrite } = await resolveWriteClients(deps);
  const existing = await read.followUp.findUnique({
    where: { id: parsed.data.followUpId },
  });
  if (!existing) {
    return serviceFail("NOT_FOUND", FOLLOW_UP_NOT_FOUND_MESSAGE);
  }

  const decision = decideCompleteFollowUp(existing.status);
  if (decision.kind === "noop") {
    return serviceOk({ followUpId: existing.id, companyId: existing.companyId });
  }
  if (decision.kind === "reject") {
    return serviceFail("CONFLICT", decision.message);
  }

  const completedAt = deps.now ?? new Date();

  await runWrite(async (tx) => {
    await tx.followUp.update({
      where: { id: existing.id },
      data: {
        status: "COMPLETED",
        completedAt,
      },
    });

    await tx.activityLog.create({
      data: {
        actorId: input.actor.id,
        entityType: "FollowUp",
        entityId: existing.id,
        action: "followup.completed",
        metadata: withActivitySource({ companyId: existing.companyId }, input.source),
      },
    });
  });

  return serviceOk({ followUpId: existing.id, companyId: existing.companyId });
}
