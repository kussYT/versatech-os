"use server";

import type { ActionResult } from "@/lib/crm/action-result";
import { getActorUser } from "@/lib/crm/actor";
import { readString } from "@/lib/crm/form-data";
import { revalidateCrm } from "@/lib/crm/revalidate";
import { prisma } from "@/lib/db/prisma";
import { fieldErrorsFromZod } from "@/lib/validations/company";
import { createFollowUpSchema } from "@/lib/validations/follow-up";

export async function createFollowUp(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = createFollowUpSchema.safeParse({
    companyId: readString(formData, "companyId"),
    dueAt: readString(formData, "dueAt"),
    note: readString(formData, "note"),
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
    const title = input.note ?? "Relance";

    const followUp = await prisma.$transaction(async (tx) => {
      const created = await tx.followUp.create({
        data: {
          companyId: company.id,
          title,
          dueAt: input.dueAt,
          status: "PENDING",
          priority: company.priority,
        },
      });

      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          entityType: "FollowUp",
          entityId: created.id,
          action: "followup.created",
          metadata: { companyId: company.id },
        },
      });

      return created;
    });

    revalidateCrm(company.id);
    return { ok: true, data: { followUpId: followUp.id } };
  } catch (error) {
    console.error(error);
    return {
      ok: false,
      message: "Impossible de planifier la relance. Réessayez.",
    };
  }
}
