"use server";

import type { ActionResult } from "@/lib/crm/action-result";
import { getActorUser } from "@/lib/crm/actor";
import { OPEN_OPPORTUNITY_STAGES } from "@/lib/crm/constants";
import { readString } from "@/lib/crm/form-data";
import { revalidateFollowUps } from "@/lib/crm/revalidate";
import { prisma } from "@/lib/db/prisma";
import { fieldErrorsFromZod } from "@/lib/validations/company";
import {
  completeFollowUpSchema,
  createFollowUpSchema,
  rescheduleFollowUpSchema,
} from "@/lib/validations/follow-up";

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
    const openOpportunity = await prisma.opportunity.findFirst({
      where: {
        companyId: company.id,
        stage: { in: [...OPEN_OPPORTUNITY_STAGES] },
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });

    const followUp = await prisma.$transaction(async (tx) => {
      const created = await tx.followUp.create({
        data: {
          companyId: company.id,
          opportunityId: openOpportunity?.id ?? null,
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

    revalidateFollowUps(company.id);
    return { ok: true, data: { followUpId: followUp.id, companyId: company.id } };
  } catch (error) {
    console.error(error);
    return {
      ok: false,
      message: "Impossible de planifier la relance. Réessayez.",
    };
  }
}

export async function completeFollowUp(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = completeFollowUpSchema.safeParse({
    followUpId: readString(formData, "followUpId"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Relance introuvable.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  try {
    const existing = await prisma.followUp.findUnique({
      where: { id: parsed.data.followUpId },
    });

    if (!existing) {
      return { ok: false, message: "Relance introuvable." };
    }

    if (existing.status === "COMPLETED") {
      return { ok: true, data: { followUpId: existing.id, companyId: existing.companyId } };
    }

    if (existing.status !== "PENDING") {
      return { ok: false, message: "Cette relance n'est plus en attente." };
    }

    const actor = await getActorUser();

    await prisma.$transaction(async (tx) => {
      await tx.followUp.update({
        where: { id: existing.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });

      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          entityType: "FollowUp",
          entityId: existing.id,
          action: "followup.completed",
          metadata: { companyId: existing.companyId },
        },
      });
    });

    revalidateFollowUps(existing.companyId);
    return { ok: true, data: { followUpId: existing.id, companyId: existing.companyId } };
  } catch (error) {
    console.error(error);
    return { ok: false, message: "Impossible de terminer la relance. Réessayez." };
  }
}

export async function rescheduleFollowUp(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = rescheduleFollowUpSchema.safeParse({
    followUpId: readString(formData, "followUpId"),
    dueAt: readString(formData, "dueAt"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Vérifiez la nouvelle date.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const input = parsed.data;

  try {
    const existing = await prisma.followUp.findUnique({
      where: { id: input.followUpId },
    });

    if (!existing) {
      return { ok: false, message: "Relance introuvable." };
    }

    if (existing.status !== "PENDING") {
      return { ok: false, message: "Seule une relance en attente peut être reportée." };
    }

    const actor = await getActorUser();

    await prisma.$transaction(async (tx) => {
      await tx.followUp.update({
        where: { id: existing.id },
        data: { dueAt: input.dueAt },
      });

      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          entityType: "FollowUp",
          entityId: existing.id,
          action: "followup.rescheduled",
          metadata: {
            companyId: existing.companyId,
            fromDueAt: existing.dueAt.toISOString(),
            toDueAt: input.dueAt.toISOString(),
          },
        },
      });
    });

    revalidateFollowUps(existing.companyId);
    return { ok: true, data: { followUpId: existing.id, companyId: existing.companyId } };
  } catch (error) {
    console.error(error);
    return { ok: false, message: "Impossible de reporter la relance. Réessayez." };
  }
}
