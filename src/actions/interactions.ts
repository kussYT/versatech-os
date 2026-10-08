"use server";

import { logServerError } from "@/lib/observability/log-error";

import type { ActionResult } from "@/lib/crm/action-result";
import { requireActor } from "@/lib/crm/actor";
import { readString } from "@/lib/crm/form-data";
import { revalidateCrm } from "@/lib/crm/revalidate";
import { toActionResult } from "@/lib/services/_shared/result";
import type { QuickInteractionInput } from "@/lib/services/interactions/quick";
import * as InteractionWriteService from "@/lib/services/interactions/write";
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

  try {
    const result = await InteractionWriteService.createInteraction(parsed.data, auth.actor);
    if (!result.ok) {
      return toActionResult(result);
    }
    revalidateCrm(result.data.companyId);
    return { ok: true, data: { interactionId: result.data.interactionId } };
  } catch (error) {
    logServerError("interactions", error);
    return {
      ok: false,
      message: "Impossible d'enregistrer l'interaction. Réessayez.",
    };
  }
}

export async function recordQuickInteraction(input: QuickInteractionInput): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }

  try {
    const result = await InteractionWriteService.recordQuickInteraction(input, auth.actor);
    if (!result.ok) {
      return toActionResult(result);
    }
    revalidateCrm(result.data.companyId);
    return {
      ok: true,
      message: result.data.message,
      data: {
        interactionId: result.data.interactionId,
        followUpId: result.data.followUpId ?? undefined,
        companyId: result.data.companyId,
      },
    };
  } catch (error) {
    logServerError("interactions.quick", error);
    return {
      ok: false,
      message: "Impossible d'enregistrer l'interaction. Réessayez.",
    };
  }
}
