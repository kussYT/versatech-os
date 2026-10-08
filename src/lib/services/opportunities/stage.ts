import "server-only";

import type { CompanyLifecycle, OpportunityStage } from "@/generated/prisma/client";
import type { SessionUser } from "@/lib/auth/types";
import { nextLifecycleAfterOpportunityStageChange } from "@/lib/crm/lifecycle";
import { applyCompanyLifecycleChange, countCompanyLifecycleFacts, type LifecycleDb } from "@/lib/crm/lifecycle-db";
import { probabilityForWrite } from "@/lib/crm/probability";
import { verifySensitiveIntent } from "@/lib/crm/sensitive-confirmation";
import {
  serviceFail,
  serviceOk,
  fieldErrorsFromZod,
  type ServiceResult,
} from "@/lib/services/_shared/result";
import {
  updateOpportunityStageSchema,
  type UpdateOpportunityStageInput,
} from "@/lib/validations/opportunity";

export const STAGE_CONFIRMATION_MESSAGE = "Confirmation serveur requise pour Gagné ou Perdu.";

type StageRow = {
  id: string;
  companyId: string;
  stage: OpportunityStage;
  lostReason: string | null;
  company: { lifecycleStatus: CompanyLifecycle };
};

export type OpportunityStageTx = {
  opportunity: {
    findUnique: (args: {
      where: { id: string };
      include: { company: true };
    }) => Promise<StageRow | null>;
    update: (args: {
      where: { id: string };
      data: {
        stage: OpportunityStage;
        probability: number;
        wonAt: Date | null;
        lostAt: Date | null;
        lostReason: string | null;
      };
    }) => Promise<unknown>;
    count: LifecycleDb["opportunity"]["count"];
  };
  quote: Pick<LifecycleDb["quote"], "count">;
  project: Pick<LifecycleDb["project"], "count">;
  company: Pick<LifecycleDb["company"], "update">;
  activityLog: Pick<LifecycleDb["activityLog"], "create">;
  opportunityStageHistory: {
    create: (args: {
      data: {
        opportunityId: string;
        fromStage: OpportunityStage;
        toStage: OpportunityStage;
        changedById: string;
      };
    }) => Promise<unknown>;
  };
};

export type OpportunityStageStore = {
  $transaction: <T>(fn: (tx: OpportunityStageTx) => Promise<T>) => Promise<T>;
};

export type ChangeOpportunityStageDeps = {
  store?: OpportunityStageStore;
  secret?: string;
  now?: Date;
  confirmationToken?: string | null;
};

function stageTimestamps(stage: OpportunityStage, now: Date) {
  if (stage === "WON") {
    return { wonAt: now, lostAt: null as Date | null };
  }
  if (stage === "LOST") {
    return { lostAt: now, wonAt: null as Date | null };
  }
  return { wonAt: null as Date | null, lostAt: null as Date | null };
}

function isSensitiveStage(stage: OpportunityStage): stage is "WON" | "LOST" {
  return stage === "WON" || stage === "LOST";
}

export type ApplyOpportunityStageInput = {
  opportunityId: string;
  stage: OpportunityStage;
  lostReason: string | null;
  actorId: string;
  now: Date;
  metadata?: Record<string, string | number | boolean | null>;
};

/**
 * Exécute le changement d'étape. Ne vérifie pas la confirmation utilisateur :
 * l'appelant doit déjà avoir autorisé l'intention (jeton Gagné/Perdu, ou
 * acceptation de devis). Même transaction que l'appelant, sans `$transaction` imbriquée.
 */
export async function applyOpportunityStageChange(
  tx: OpportunityStageTx,
  input: ApplyOpportunityStageInput,
): Promise<
  ServiceResult<{
    opportunityId: string;
    companyId: string;
    unchanged: boolean;
    lifecycleTo: CompanyLifecycle | null;
  }>
> {
  const existing = await tx.opportunity.findUnique({
    where: { id: input.opportunityId },
    include: { company: true },
  });
  if (!existing) {
    return serviceFail("NOT_FOUND", "Opportunité introuvable.");
  }

  if (existing.stage === input.stage) {
    return serviceOk({
      opportunityId: existing.id,
      companyId: existing.companyId,
      unchanged: true,
      lifecycleTo: null,
    });
  }

  const probability = probabilityForWrite(input.stage);
  await tx.opportunity.update({
    where: { id: existing.id },
    data: {
      stage: input.stage,
      probability,
      ...stageTimestamps(input.stage, input.now),
      lostReason: input.stage === "LOST" ? input.lostReason : existing.lostReason,
    },
  });

  await tx.opportunityStageHistory.create({
    data: {
      opportunityId: existing.id,
      fromStage: existing.stage,
      toStage: input.stage,
      changedById: input.actorId,
    },
  });

  const facts = await countCompanyLifecycleFacts(
    tx as unknown as LifecycleDb,
    existing.companyId,
    existing.company.lifecycleStatus,
  );
  const nextLifecycle = nextLifecycleAfterOpportunityStageChange({
    currentCompany: existing.company.lifecycleStatus,
    fromStage: existing.stage,
    toStage: input.stage,
    factsAfterChange: facts,
  });

  await applyCompanyLifecycleChange(tx as unknown as LifecycleDb, {
    companyId: existing.companyId,
    from: existing.company.lifecycleStatus,
    to: nextLifecycle,
    actorId: input.actorId,
    reason: "opportunity.stage_changed",
    metadata: {
      opportunityId: existing.id,
      fromStage: existing.stage,
      toStage: input.stage,
      ...input.metadata,
    },
  });

  await tx.activityLog.create({
    data: {
      actorId: input.actorId,
      entityType: "Opportunity",
      entityId: existing.id,
      action: "opportunity.stage_changed",
      metadata: {
        companyId: existing.companyId,
        fromStage: existing.stage,
        toStage: input.stage,
        probability,
        ...input.metadata,
      },
    },
  });

  return serviceOk({
    opportunityId: existing.id,
    companyId: existing.companyId,
    unchanged: false,
    lifecycleTo: nextLifecycle,
  });
}

export async function changeOpportunityStage(
  input: UpdateOpportunityStageInput,
  actor: SessionUser,
  deps: ChangeOpportunityStageDeps = {},
): Promise<ServiceResult<{ opportunityId: string; companyId: string; unchanged: boolean }>> {
  if (!actor?.id) {
    return serviceFail("AUTH_REQUIRED", "Authentification requise.");
  }

  const parsed = updateOpportunityStageSchema.safeParse(input);
  if (!parsed.success) {
    return serviceFail(
      "VALIDATION",
      "Vérifiez le changement de stage.",
      fieldErrorsFromZod(parsed.error),
    );
  }
  const data = parsed.data;
  const now = deps.now ?? new Date();
  const secret = deps.secret ?? "";

  const store = await resolveStore(deps.store);
  return store.$transaction(async (tx) => {
    const existing = await tx.opportunity.findUnique({
      where: { id: data.opportunityId },
      include: { company: true },
    });
    if (!existing) {
      return serviceFail("NOT_FOUND", "Opportunité introuvable.");
    }

    if (existing.stage === data.stage) {
      return serviceOk({
        opportunityId: existing.id,
        companyId: existing.companyId,
        unchanged: true,
      });
    }

    if (isSensitiveStage(data.stage)) {
      const allowed = secret
        ? verifySensitiveIntent(
            deps.confirmationToken,
            {
              kind: "opportunity-stage",
              actorId: actor.id,
              opportunityId: existing.id,
              stage: data.stage,
              lostReason: data.stage === "LOST" ? data.lostReason : null,
            },
            secret,
            now,
          )
        : false;
      if (!allowed) {
        return serviceFail("CONFIRMATION_REQUIRED", STAGE_CONFIRMATION_MESSAGE);
      }
    }

    return applyOpportunityStageChange(tx, {
      opportunityId: existing.id,
      stage: data.stage,
      lostReason: data.stage === "LOST" ? data.lostReason : null,
      actorId: actor.id,
      now,
    });
  });
}

async function resolveStore(store?: OpportunityStageStore): Promise<OpportunityStageStore> {
  if (store) {
    return store;
  }
  const { prisma } = await import("@/lib/db/prisma");
  return prisma as unknown as OpportunityStageStore;
}
