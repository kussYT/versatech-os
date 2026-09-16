"use server";

import type { ActionResult } from "@/lib/crm/action-result";
import { getActorUser } from "@/lib/crm/actor";
import { readString } from "@/lib/crm/form-data";
import { revalidateCrm } from "@/lib/crm/revalidate";
import { prisma } from "@/lib/db/prisma";
import { fieldErrorsFromZod } from "@/lib/validations/company";
import { createInteractionSchema } from "@/lib/validations/interaction";

export async function createInteraction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
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

    const actor = await getActorUser();
    const shouldMarkContacted =
      company.lifecycleStatus === "LEAD" &&
      (input.type === "CALL" ||
        input.type === "EMAIL" ||
        input.type === "MEETING" ||
        input.type === "MESSAGE");

    const interaction = await prisma.$transaction(async (tx) => {
      const created = await tx.interaction.create({
        data: {
          companyId: company.id,
          type: input.type,
          direction: input.direction,
          result: input.result,
          notes: input.notes,
          occurredAt: input.occurredAt,
          createdById: actor.id,
        },
      });

      if (shouldMarkContacted) {
        await tx.company.update({
          where: { id: company.id },
          data: { lifecycleStatus: "CONTACTED" },
        });
      }

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
    console.error(error);
    return {
      ok: false,
      message: "Impossible d'enregistrer l'interaction. Réessayez.",
    };
  }
}
