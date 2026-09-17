"use server";

import { logServerError } from "@/lib/observability/log-error";

import type { ActionResult } from "@/lib/crm/action-result";
import { requireActor } from "@/lib/crm/actor";
import { OPEN_OPPORTUNITY_STAGES } from "@/lib/crm/constants";
import { readString } from "@/lib/crm/form-data";
import { lifecycleAfterInteraction } from "@/lib/crm/lifecycle";
import { applyCompanyLifecycleChange } from "@/lib/crm/lifecycle-db";
import { revalidateCrm } from "@/lib/crm/revalidate";
import { prisma } from "@/lib/db/prisma";
import { fieldErrorsFromZod } from "@/lib/validations/company";
import { createInteractionSchema } from "@/lib/validations/interaction";

export async function createInteraction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }
  const { actor } = auth;
  const parsed = createInteractionSchema.safeParse({
    companyId: readString(formData, "companyId"),
    type: readString(formData, "type"),
    direction: readString(formData, "direction"),
    result: readString(formData, "result"),
    occurredAt: readString(formData, "occurredAt"),
    notes: readString(formData, "notes"),
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

    const nextLifecycle = lifecycleAfterInteraction(company.lifecycleStatus, input.type);

    const openOpportunity = await prisma.opportunity.findFirst({
      where: {
        companyId: company.id,
        stage: { in: [...OPEN_OPPORTUNITY_STAGES] },
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });

    const interaction = await prisma.$transaction(async (tx) => {
      const created = await tx.interaction.create({
        data: {
          companyId: company.id,
          opportunityId: openOpportunity?.id ?? null,
          type: input.type,
          direction: input.direction,
          result: input.result,
          notes: input.notes,
          occurredAt: input.occurredAt,
          createdById: actor.id,
        },
      });

      await applyCompanyLifecycleChange(tx, {
        companyId: company.id,
        from: company.lifecycleStatus,
        to: nextLifecycle,
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

      return created;
    });

    revalidateCrm(company.id);
    return { ok: true, data: { interactionId: interaction.id } };
  } catch (error) {
    logServerError("interactions", error);
    return {
      ok: false,
      message: "Impossible d'enregistrer l'interaction. Réessayez.",
    };
  }
}
