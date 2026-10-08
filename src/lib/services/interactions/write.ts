import "server-only";

import { z } from "zod";
import {
  InteractionDirection,
  InteractionResult,
  type CompanyLifecycle,
  type Priority,
} from "@/generated/prisma/client";
import type { SessionUser } from "@/lib/auth/types";
import { OPEN_OPPORTUNITY_STAGES } from "@/lib/crm/constants";
import { lifecycleAfterInteraction } from "@/lib/crm/lifecycle";
import { applyCompanyLifecycleChange, type LifecycleDb } from "@/lib/crm/lifecycle-db";
import {
  fieldErrorsFromZod,
  serviceFail,
  serviceOk,
  type ServiceResult,
} from "@/lib/services/_shared/result";
import {
  quickFollowUpTitle,
  quickInteractionDirection,
  quickInteractionFeedback,
  quickInteractionInputSchema,
  quickInteractionResult,
  quickInteractionSubject,
  resolveQuickFollowUpDueAt,
  type QuickInteractionInput,
} from "@/lib/services/interactions/quick";

export const INTERACTION_VALIDATION_MESSAGE = "Vérifiez les champs du formulaire.";
export const INTERACTION_COMPANY_NOT_FOUND_MESSAGE = "Entreprise introuvable.";

/** Same subset as the interaction form (`validations/interaction.ts`). */
const INTERACTION_TYPES = ["CALL", "EMAIL", "MEETING", "MESSAGE", "NOTE"] as const;

/** Object input (no FormData): `occurredAt` is already a Date. */
export const createInteractionInputSchema = z.object({
  companyId: z.string().min(1, "Entreprise introuvable"),
  type: z.enum(INTERACTION_TYPES, { error: "Type d'interaction invalide" }),
  direction: z.enum(InteractionDirection, { error: "Direction invalide" }),
  result: z.enum(InteractionResult).nullable(),
  occurredAt: z.date("La date de l'interaction est obligatoire"),
  notes: z.string().nullable(),
});

export type CreateInteractionServiceInput = z.input<typeof createInteractionInputSchema>;

type InteractionType = (typeof INTERACTION_TYPES)[number];

export type InteractionWriteTx = {
  company: {
    findUnique: (args: {
      where: { id: string };
      select: { id: true; lifecycleStatus: true };
    }) => Promise<{ id: string; lifecycleStatus: CompanyLifecycle } | null>;
    update: (args: {
      where: { id: string };
      data: { lifecycleStatus: CompanyLifecycle };
    }) => Promise<unknown>;
  };
  opportunity: {
    findFirst: (args: {
      where: { companyId: string; id?: string; stage?: { in: string[] } };
      orderBy?: { updatedAt: "desc" };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
  };
  interaction: {
    create: (args: {
      data: {
        companyId: string;
        opportunityId: string | null;
        type: InteractionType;
        direction: InteractionDirection;
        result: InteractionResult | null;
        notes: string | null;
        occurredAt: Date;
        createdById: string;
      };
    }) => Promise<{ id: string; type: InteractionType }>;
  };
  activityLog: {
    create: (args: {
      data: {
        actorId: string;
        entityType: "Interaction" | "Company";
        entityId: string;
        action: string;
        metadata: Record<string, string | number | boolean | null>;
      };
    }) => Promise<unknown>;
  };
};

export type InteractionWriteStore = {
  $transaction: <T>(fn: (tx: InteractionWriteTx) => Promise<T>) => Promise<T>;
};

export type InteractionWriteDeps = {
  store?: InteractionWriteStore;
};

async function resolveStore(store?: InteractionWriteStore): Promise<InteractionWriteStore> {
  if (store) {
    return store;
  }
  const { prisma } = await import("@/lib/db/prisma");
  return prisma as unknown as InteractionWriteStore;
}

/**
 * Journalise une interaction. LEAD → CONTACTED via `lifecycleAfterInteraction`.
 * Lecture entreprise / opportunité ouverte, écriture et ActivityLog dans une seule transaction.
 */
export async function createInteraction(
  input: CreateInteractionServiceInput,
  actor: SessionUser,
  deps: InteractionWriteDeps = {},
): Promise<ServiceResult<{ interactionId: string; companyId: string }>> {
  if (!actor?.id) {
    return serviceFail("AUTH_REQUIRED", "Authentification requise.");
  }

  const parsed = createInteractionInputSchema.safeParse(input);
  if (!parsed.success) {
    return serviceFail(
      "VALIDATION",
      INTERACTION_VALIDATION_MESSAGE,
      fieldErrorsFromZod(parsed.error),
    );
  }
  const data = parsed.data;

  const store = await resolveStore(deps.store);
  return store.$transaction(
    async (tx): Promise<ServiceResult<{ interactionId: string; companyId: string }>> => {
      const company = await tx.company.findUnique({
        where: { id: data.companyId },
        select: { id: true, lifecycleStatus: true },
      });
      if (!company) {
        return serviceFail("NOT_FOUND", INTERACTION_COMPANY_NOT_FOUND_MESSAGE);
      }

      const openOpportunity = await tx.opportunity.findFirst({
        where: {
          companyId: company.id,
          stage: { in: [...OPEN_OPPORTUNITY_STAGES] },
        },
        orderBy: { updatedAt: "desc" },
        select: { id: true },
      });

      const created = await tx.interaction.create({
        data: {
          companyId: company.id,
          opportunityId: openOpportunity?.id ?? null,
          type: data.type,
          direction: data.direction,
          result: data.result,
          notes: data.notes,
          occurredAt: data.occurredAt,
          createdById: actor.id,
        },
      });

      await applyCompanyLifecycleChange(tx as unknown as LifecycleDb, {
        companyId: company.id,
        from: company.lifecycleStatus,
        to: lifecycleAfterInteraction(company.lifecycleStatus, data.type, data.result),
        actorId: actor.id,
        reason: "interaction.created",
        metadata: { type: created.type },
      });

      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          entityType: "Interaction",
          entityId: created.id,
          action: "interaction.created",
          metadata: { type: created.type, companyId: company.id },
        },
      });

      return serviceOk({ interactionId: created.id, companyId: company.id });
    },
  );
}

export type QuickInteractionWriteTx = {
  company: {
    findUnique: (args: {
      where: { id: string };
      select: { id: true; lifecycleStatus: true; priority: true };
    }) => Promise<{ id: string; lifecycleStatus: CompanyLifecycle; priority: Priority } | null>;
    update: InteractionWriteTx["company"]["update"];
  };
  opportunity: InteractionWriteTx["opportunity"];
  interaction: {
    create: (args: {
      data: {
        companyId: string;
        opportunityId: string | null;
        type: InteractionType;
        direction: InteractionDirection;
        result: InteractionResult | null;
        subject: string | null;
        notes: string | null;
        occurredAt: Date;
        createdById: string;
      };
    }) => Promise<{ id: string; type: InteractionType }>;
  };
  followUp: {
    create: (args: {
      data: {
        companyId: string;
        opportunityId: string | null;
        title: string;
        dueAt: Date;
        status: "PENDING";
        priority: Priority;
        sourceInteractionId: string;
      };
    }) => Promise<{ id: string }>;
  };
  activityLog: {
    create: (args: {
      data: {
        actorId: string;
        entityType: "Interaction" | "Company" | "FollowUp";
        entityId: string;
        action: string;
        metadata: Record<string, string | number | boolean | null>;
      };
    }) => Promise<unknown>;
  };
};

export type QuickInteractionWriteStore = {
  $transaction: <T>(fn: (tx: QuickInteractionWriteTx) => Promise<T>) => Promise<T>;
};

export type QuickInteractionResult = {
  interactionId: string;
  companyId: string;
  followUpId: string | null;
  followUpDueAt: string | null;
  message: string;
};

/**
 * Interaction rapide + relance optionnelle, dans une seule transaction.
 * Si la relance échoue, l'interaction n'est pas conservée.
 */
export async function recordQuickInteraction(
  input: QuickInteractionInput,
  actor: SessionUser,
  deps: { store?: QuickInteractionWriteStore; now?: Date } = {},
): Promise<ServiceResult<QuickInteractionResult>> {
  if (!actor?.id) {
    return serviceFail("AUTH_REQUIRED", "Authentification requise.");
  }

  const parsed = quickInteractionInputSchema.safeParse(input);
  if (!parsed.success) {
    return serviceFail(
      "VALIDATION",
      INTERACTION_VALIDATION_MESSAGE,
      fieldErrorsFromZod(parsed.error),
    );
  }
  const data = parsed.data;
  const now = deps.now ?? new Date();
  const dueAt = resolveQuickFollowUpDueAt(data.followUp, data.customDueDate, now);
  if (data.followUp !== "none" && !dueAt) {
    return serviceFail("VALIDATION", "Choisissez une date de relance valide.");
  }

  const store = await resolveQuickStore(deps.store);
  return store.$transaction(async (tx) => {
    const company = await tx.company.findUnique({
      where: { id: data.companyId },
      select: { id: true, lifecycleStatus: true, priority: true },
    });
    if (!company) {
      return serviceFail("NOT_FOUND", INTERACTION_COMPANY_NOT_FOUND_MESSAGE);
    }

    const openOpportunity = data.opportunityId
      ? await tx.opportunity.findFirst({
          where: { companyId: company.id, id: data.opportunityId },
          select: { id: true },
        })
      : await tx.opportunity.findFirst({
          where: {
            companyId: company.id,
            stage: { in: [...OPEN_OPPORTUNITY_STAGES] },
          },
          orderBy: { updatedAt: "desc" },
          select: { id: true },
        });
    if (data.opportunityId && !openOpportunity) {
      return serviceFail("NOT_FOUND", "Opportunité introuvable pour cette entreprise.");
    }

    const result = quickInteractionResult(data.type, data.callOutcome);
    const created = await tx.interaction.create({
      data: {
        companyId: company.id,
        opportunityId: openOpportunity?.id ?? null,
        type: data.type,
        direction: quickInteractionDirection(data.type),
        result,
        subject: quickInteractionSubject(data.type, data.channel),
        notes: data.notes,
        occurredAt: now,
        createdById: actor.id,
      },
    });

    await applyCompanyLifecycleChange(tx as unknown as LifecycleDb, {
      companyId: company.id,
      from: company.lifecycleStatus,
      to: lifecycleAfterInteraction(company.lifecycleStatus, data.type, result),
      actorId: actor.id,
      reason: "interaction.created",
      metadata: { type: created.type },
    });

    await tx.activityLog.create({
      data: {
        actorId: actor.id,
        entityType: "Interaction",
        entityId: created.id,
        action: "interaction.created",
        metadata: { type: created.type, companyId: company.id },
      },
    });

    let followUpId: string | null = null;
    if (dueAt) {
      const followUp = await tx.followUp.create({
        data: {
          companyId: company.id,
          opportunityId: openOpportunity?.id ?? null,
          title: quickFollowUpTitle(data.type, data.callOutcome),
          dueAt,
          status: "PENDING",
          priority: company.priority,
          sourceInteractionId: created.id,
        },
      });
      followUpId = followUp.id;
      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          entityType: "FollowUp",
          entityId: followUp.id,
          action: "followup.created",
          metadata: { companyId: company.id },
        },
      });
    }

    return serviceOk({
      interactionId: created.id,
      companyId: company.id,
      followUpId,
      followUpDueAt: dueAt ? dueAt.toISOString() : null,
      message: quickInteractionFeedback(dueAt),
    });
  });
}

async function resolveQuickStore(
  store?: QuickInteractionWriteStore,
): Promise<QuickInteractionWriteStore> {
  if (store) {
    return store;
  }
  const { prisma } = await import("@/lib/db/prisma");
  return prisma as unknown as QuickInteractionWriteStore;
}
