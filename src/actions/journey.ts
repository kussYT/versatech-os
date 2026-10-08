"use server";

import { logServerError } from "@/lib/observability/log-error";

import type { ActionResult } from "@/lib/crm/action-result";
import { requireActor } from "@/lib/crm/actor";
import { readString } from "@/lib/crm/form-data";
import { revalidateCrm } from "@/lib/crm/revalidate";
import { JourneyService } from "@/lib/services/journey/write";
import { fieldErrorsFromZod } from "@/lib/services/_shared/result";
import { resetJourneyStepSchema, setJourneyStepSchema } from "@/lib/validations/journey";

function readContext(formData: FormData) {
  return {
    companyId: readString(formData, "companyId"),
    opportunityId: readString(formData, "opportunityId"),
    projectId: readString(formData, "projectId"),
  };
}

export async function setJourneyStep(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }
  const parsed = setJourneyStepSchema.safeParse({
    ...readContext(formData),
    step: readString(formData, "step"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Choisissez une étape du parcours.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  try {
    const result = await JourneyService.setDeclaredJourneyStep({
      actor: auth.actor,
      ...parsed.data,
    });
    if (!result.ok) {
      return { ok: false, message: result.message, fieldErrors: result.fieldErrors };
    }
    revalidateCrm(result.data.companyId);
    return { ok: true, message: "Étape déclarée enregistrée. Les devis et paiements sont inchangés." };
  } catch (error) {
    logServerError("journey", error);
    return { ok: false, message: "Impossible d'enregistrer l'étape. Réessayez." };
  }
}

export async function resetJourneyStep(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }
  const parsed = resetJourneyStepSchema.safeParse(readContext(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Prestation introuvable.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  try {
    const result = await JourneyService.resetDeclaredJourneyStep({
      actor: auth.actor,
      ...parsed.data,
    });
    if (!result.ok) {
      return { ok: false, message: result.message, fieldErrors: result.fieldErrors };
    }
    revalidateCrm(result.data.companyId);
    return { ok: true, message: "Le parcours de cette prestation suit à nouveau les faits." };
  } catch (error) {
    logServerError("journey", error);
    return { ok: false, message: "Impossible de réinitialiser l'étape. Réessayez." };
  }
}
