"use server";

import type { CompanyLifecycle, OpportunityStage } from "@/generated/prisma/client";
import type { ActionResult } from "@/lib/crm/action-result";
import { getActorUser } from "@/lib/crm/actor";
import { readString } from "@/lib/crm/form-data";
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

function lifecycleAfterOpportunityCreated(current: CompanyLifecycle): CompanyLifecycle | null {
  if (current === "LEAD" || current === "CONTACTED" || current === "QUALIFIED") {
    return "OPPORTUNITY";
  }

  return null;
}

function lifecycleAfterWon(current: CompanyLifecycle): CompanyLifecycle | null {
  return current === "CLIENT" ? null : "CLIENT";
}

function stageTimestamps(stage: OpportunityStage) {
  if (stage === "WON") {
    return { wonAt: new Date() };
  }

  if (stage === "LOST") {
    return { lostAt: new Date() };
  }

  return {};
}

export async function createOpportunity(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = createOpportunitySchema.safeParse({
    companyId: readString(formData, "companyId"),
    title: readString(formData, "title"),
    estimatedValue: readString(formData, "estimatedValue"),
    stage: readString(formData, "stage"),
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

    const actor = await getActorUser();
    const nextLifecycle = lifecycleAfterOpportunityCreated(company.lifecycleStatus);

    const opportunity = await prisma.$transaction(async (tx) => {
      const created = await tx.opportunity.create({
        data: {
          companyId: company.id,
          title: input.title,
          stage: input.stage,
          estimatedValue: input.estimatedValue,
          source: company.source,
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

      if (nextLifecycle) {
        await tx.company.update({
          where: { id: company.id },
          data: { lifecycleStatus: nextLifecycle },
        });
      }

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

    const actor = await getActorUser();
    const nextLifecycle =
      input.stage === "WON" ? lifecycleAfterWon(existing.company.lifecycleStatus) : null;

    await prisma.$transaction(async (tx) => {
      await tx.opportunity.update({
        where: { id: existing.id },
        data: {
          stage: input.stage,
          ...stageTimestamps(input.stage),
          lostReason:
            input.stage === "LOST" ? input.lostReason ?? existing.lostReason : existing.lostReason,
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

      if (nextLifecycle) {
        await tx.company.update({
          where: { id: existing.companyId },
          data: { lifecycleStatus: nextLifecycle },
        });
      }

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
