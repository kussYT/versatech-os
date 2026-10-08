"use server";

import { logServerError } from "@/lib/observability/log-error";

import type { OpportunityStage } from "@/generated/prisma/client";
import type { ActionResult } from "@/lib/crm/action-result";
import { requireActor } from "@/lib/crm/actor";
import { getAuthSecret } from "@/lib/auth/config";
import { readString } from "@/lib/crm/form-data";
import { applyCompanyLifecycleChange } from "@/lib/crm/lifecycle-db";
import { lifecycleAfterOpportunityCreated } from "@/lib/crm/lifecycle";
import { probabilityForWrite } from "@/lib/crm/probability";
import { revalidatePipeline } from "@/lib/crm/revalidate";
import { OPPORTUNITY_STAGE_LABELS } from "@/lib/crm/constants";
import { signSensitiveIntent } from "@/lib/crm/sensitive-confirmation";
import { prisma } from "@/lib/db/prisma";
import { changeOpportunityStage } from "@/lib/services/opportunities/stage";
import { toActionResult } from "@/lib/services/_shared/result";
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
    logServerError("opportunities", error);
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
  const confirmationToken = readString(formData, "confirmationToken").trim() || null;

  try {
    const sensitive = input.stage === "WON" || input.stage === "LOST";
    const secret = sensitive ? getAuthSecret() : "";
    const result = await changeOpportunityStage(input, actor, {
      secret,
      confirmationToken,
    });
    if (!result.ok && result.code === "CONFIRMATION_REQUIRED" && (input.stage === "WON" || input.stage === "LOST")) {
      const issuedToken = signSensitiveIntent(
        {
          kind: "opportunity-stage",
          actorId: actor.id,
          opportunityId: input.opportunityId,
          stage: input.stage,
          lostReason: input.stage === "LOST" ? input.lostReason : null,
          exp: Date.now() + 10 * 60 * 1000,
        },
        secret,
      );
      return {
        ok: false,
        message: result.message,
        data: { confirmationToken: issuedToken, opportunityId: input.opportunityId },
      };
    }
    if (!result.ok) {
      return toActionResult(result);
    }
    revalidatePipeline(result.data.companyId);
    return {
      ok: true,
      message: result.data.unchanged
        ? "Étape inchangée."
        : input.stage === "WON"
          ? "Opportunité gagnée. L'entreprise est cliente."
          : `Étape mise à jour : ${OPPORTUNITY_STAGE_LABELS[input.stage]}`,
      data: { opportunityId: result.data.opportunityId, companyId: result.data.companyId },
    };
  } catch (error) {
    logServerError("opportunities", error);
    return { ok: false, message: userFacingDbError() };
  }
}
