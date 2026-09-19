"use server";

import { logServerError } from "@/lib/observability/log-error";

import type { ActionResult } from "@/lib/crm/action-result";
import { requireActor } from "@/lib/crm/actor";
import { readString } from "@/lib/crm/form-data";
import { revalidateFollowUps } from "@/lib/crm/revalidate";
import { prisma } from "@/lib/db/prisma";
import { fieldErrorsFromZod } from "@/lib/validations/company";
import {
  completeFollowUpSchema,
  createFollowUpSchema,
  rescheduleFollowUpSchema,
} from "@/lib/validations/follow-up";
import { FollowUpService } from "@/lib/services/follow-ups";
import { toActionResult } from "@/lib/services/_shared/result";

export async function createFollowUp(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }
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

  try {
    const result = await FollowUpService.createFollowUp({
      actor: auth.actor,
      companyId: parsed.data.companyId,
      dueAt: parsed.data.dueAt,
      title: parsed.data.note,
    });
    if (!result.ok) {
      return toActionResult(result);
    }
    revalidateFollowUps(result.data.companyId);
    return toActionResult(result);
  } catch (error) {
    logServerError("follow-ups", error);
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
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }
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
    const result = await FollowUpService.completeFollowUp({
      actor: auth.actor,
      followUpId: parsed.data.followUpId,
    });
    if (!result.ok) {
      return toActionResult(result);
    }
    revalidateFollowUps(result.data.companyId);
    return toActionResult(result);
  } catch (error) {
    logServerError("follow-ups", error);
    return { ok: false, message: "Impossible de terminer la relance. Réessayez." };
  }
}

export async function rescheduleFollowUp(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }
  const { actor } = auth;
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
    logServerError("follow-ups", error);
    return { ok: false, message: "Impossible de reporter la relance. Réessayez." };
  }
}
