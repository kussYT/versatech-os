"use server";

import type { OpportunityStage } from "@/generated/prisma/client";
import type { ActionResult } from "@/lib/crm/action-result";
import { requireActor } from "@/lib/crm/actor";
import { readString } from "@/lib/crm/form-data";
import {
  applyCompanyLifecycleChange,
  countCompanyLifecycleFacts,
} from "@/lib/crm/lifecycle-db";
import {
  lifecycleAfterOpportunityCreated,
  nextLifecycleAfterOpportunityStageChange,
} from "@/lib/crm/lifecycle";
import { probabilityForWrite } from "@/lib/crm/probability";
import { revalidatePipeline } from "@/lib/crm/revalidate";
import { prisma } from "@/lib/db/prisma";
import {
  createOpportunitySchema,
  fieldErrorsFromZod,
  updateOpportunityStageSchema,
} from "@/lib/validations/opportunity";

function userFacingDbError() {
  return "Impossible d'enregistrer l'opportunité. Réessayez.";
}

function stageTimestamps(stage: OpportunityStage) {
  if (stage === "WON") {
    return { wonAt: new Date(), lostAt: null };
  }

  if (stage === "LOST") {
    return { lostAt: new Date(), wonAt: null };
  }

  return { wonAt: null, lostAt: null };
}

export async function createOpportunity(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }
  const { actor } = auth;
  const parsed = createOpportunitySchema.safeParse({
    companyId: readString(formData, "companyId"),
    title: readString(formData, "title"),
    estimatedValue: readString(formData, "estimatedValue"),
    stage: readString(formData, "stage"),
    probability: readString(formData, "probability"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Vérifiez les champs du formulaire.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const input = parsed.data;

  try {
    const company = await prisma.company.findUnique({
      where: { id: input.companyId },
    });

    if (!company) {
      return { ok: false, message: "Entreprise introuvable." };
    }

    const nextLifecycle = lifecycleAfterOpportunityCreated(company.lifecycleStatus);
    const probability = probabilityForWrite(input.stage, input.probability);

    const opportunity = await prisma.$transaction(async (tx) => {
      const created = await tx.opportunity.create({
        data: {
          companyId: company.id,
          title: input.title,
          stage: input.stage,
          estimatedValue: input.estimatedValue,
          probability,
          source: company.source,
          ...stageTimestamps(input.stage),
        },
      });

      await tx.opportunityStageHistory.create({
        data: {
          opportunityId: created.id,
          fromStage: null,
          toStage: created.stage,
          changedById: actor.id,
        },
      });

      await applyCompanyLifecycleChange(tx, {
        companyId: company.id,
        from: company.lifecycleStatus,
        to: nextLifecycle,
        actorId: actor.id,
        reason: "opportunity.created",
        metadata: { opportunityId: created.id },
      });

      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          entityType: "Opportunity",
          entityId: created.id,
          action: "opportunity.created",
          metadata: {
            title: created.title,
            companyId: company.id,
            stage: created.stage,
            probability,
          },
        },
      });

      return created;
    });

    revalidatePipeline(company.id);
    return { ok: true, data: { opportunityId: opportunity.id, companyId: company.id } };
  } catch (error) {
    console.error(error);
    return { ok: false, message: userFacingDbError() };
  }
}

export async function updateOpportunityStage(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }
  const { actor } = auth;
  const parsed = updateOpportunityStageSchema.safeParse({
    opportunityId: readString(formData, "opportunityId"),
    stage: readString(formData, "stage"),
    lostReason: readString(formData, "lostReason"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Vérifiez le changement de stage.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const input = parsed.data;

  try {
    const existing = await prisma.opportunity.findUnique({
      where: { id: input.opportunityId },
      include: { company: true },
    });

    if (!existing) {
      return { ok: false, message: "Opportunité introuvable." };
    }

    if (existing.stage === input.stage) {
      return { ok: true, data: { opportunityId: existing.id, companyId: existing.companyId } };
    }

    const probability = probabilityForWrite(input.stage);

    await prisma.$transaction(async (tx) => {
      await tx.opportunity.update({
        where: { id: existing.id },
        data: {
          stage: input.stage,
          probability,
          ...stageTimestamps(input.stage),
          lostReason: input.stage === "LOST" ? input.lostReason : existing.lostReason,
        },
      });

      await tx.opportunityStageHistory.create({
        data: {
          opportunityId: existing.id,
          fromStage: existing.stage,
          toStage: input.stage,
          changedById: actor.id,
        },
      });

      const facts = await countCompanyLifecycleFacts(
        tx,
        existing.companyId,
        existing.company.lifecycleStatus,
      );
      const nextLifecycle = nextLifecycleAfterOpportunityStageChange({
        currentCompany: existing.company.lifecycleStatus,
        fromStage: existing.stage,
        toStage: input.stage,
        factsAfterChange: facts,
      });

      await applyCompanyLifecycleChange(tx, {
        companyId: existing.companyId,
        from: existing.company.lifecycleStatus,
        to: nextLifecycle,
        actorId: actor.id,
        reason: "opportunity.stage_changed",
        metadata: {
          opportunityId: existing.id,
          fromStage: existing.stage,
          toStage: input.stage,
        },
      });

      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          entityType: "Opportunity",
          entityId: existing.id,
          action: "opportunity.stage_changed",
          metadata: {
            companyId: existing.companyId,
            fromStage: existing.stage,
            toStage: input.stage,
            probability,
          },
        },
      });
    });

    revalidatePipeline(existing.companyId);
    return { ok: true, data: { opportunityId: existing.id, companyId: existing.companyId } };
  } catch (error) {
    console.error(error);
    return { ok: false, message: userFacingDbError() };
  }
}
