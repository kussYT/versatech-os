"use server";

import type { CompanyLifecycle } from "@/generated/prisma/client";
import { logServerError } from "@/lib/observability/log-error";
import { COMPANY_LIFECYCLE_LABELS } from "@/lib/crm/constants";

import type { ActionResult } from "@/lib/crm/action-result";
import { getAuthSecret } from "@/lib/auth/config";
import { requireActor } from "@/lib/crm/actor";
import { readString } from "@/lib/crm/form-data";
import { revalidateCrm } from "@/lib/crm/revalidate";
import { toActionResult } from "@/lib/services/_shared/result";
import * as CompanyWriteService from "@/lib/services/companies/write";
import {
  createCompanySchema,
  fieldErrorsFromZod,
  updateCompanyFieldActionSchema,
  updateCompanySchema,
} from "@/lib/validations/company";

function userFacingDbError() {
  return "Impossible d'enregistrer l'entreprise. Réessayez.";
}

function readCompanyProfile(formData: FormData) {
  return {
    name: readString(formData, "name"),
    industry: readString(formData, "industry"),
    address: readString(formData, "address"),
    city: readString(formData, "city"),
    postalCode: readString(formData, "postalCode"),
    phone: readString(formData, "phone"),
    email: readString(formData, "email"),
    website: readString(formData, "website"),
    instagram: readString(formData, "instagram"),
    linkedin: readString(formData, "linkedin"),
    source: readString(formData, "source"),
    description: readString(formData, "description"),
    contactFirstName: readString(formData, "contactFirstName"),
    contactLastName: readString(formData, "contactLastName"),
    contactRole: readString(formData, "contactRole"),
  };
}

export async function createCompany(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }
  const parsed = createCompanySchema.safeParse(readCompanyProfile(formData));

  if (!parsed.success) {
    return {
      ok: false,
      message: "Vérifiez les champs du formulaire.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  try {
    const result = await CompanyWriteService.createCompany(parsed.data, auth.actor);
    if (result.ok) {
      revalidateCrm(result.data.companyId);
    }
    return toActionResult(result);
  } catch (error) {
    logServerError("companies", error);
    return { ok: false, message: userFacingDbError() };
  }
}

export async function updateCompany(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }
  const parsed = updateCompanySchema.safeParse({
    ...readCompanyProfile(formData),
    id: readString(formData, "id"),
    lifecycleStatus: readString(formData, "lifecycleStatus"),
    priority: readString(formData, "priority"),
    contactPhone: readString(formData, "contactPhone"),
    contactEmail: readString(formData, "contactEmail"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Vérifiez les champs du formulaire.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  try {
    const sensitive =
      parsed.data.lifecycleStatus === "CLIENT" || parsed.data.lifecycleStatus === "LOST";
    const secret = sensitive ? getAuthSecret() : "";
    const result = await CompanyWriteService.updateCompany(parsed.data, auth.actor, {
      secret,
      confirmationToken: readString(formData, "confirmationToken").trim() || null,
    });
    if (
      !result.ok &&
      result.code === "CONFIRMATION_REQUIRED" &&
      (parsed.data.lifecycleStatus === "CLIENT" || parsed.data.lifecycleStatus === "LOST")
    ) {
      const { signSensitiveIntent } = await import("@/lib/crm/sensitive-confirmation");
      return {
        ok: false,
        message: result.message,
        data: {
          companyId: parsed.data.id,
          confirmationToken: signSensitiveIntent(
            {
              kind: "company-lifecycle",
              actorId: auth.actor.id,
              companyId: parsed.data.id,
              lifecycle: parsed.data.lifecycleStatus,
              exp: Date.now() + 10 * 60 * 1000,
            },
            secret,
          ),
        },
      };
    }
    if (result.ok) {
      revalidateCrm(result.data.companyId);
    }
    return toActionResult(result);
  } catch (error) {
    logServerError("companies", error);
    return { ok: false, message: userFacingDbError() };
  }
}

export async function updateCompanyField(input: {
  companyId: string;
  field: string;
  value: string;
}): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }

  const parsed = updateCompanyFieldActionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Vérifiez les champs du formulaire.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  try {
    const result = await CompanyWriteService.updateCompanyField(
      parsed.data.companyId,
      parsed.data.field,
      parsed.data.value,
      auth.actor,
    );
    if (result.ok) {
      revalidateCrm(result.data.companyId);
    }
    return toActionResult(result);
  } catch (error) {
    logServerError("companies", error);
    return { ok: false, message: userFacingDbError() };
  }
}

export async function changeCompanyLifecycle(input: {
  companyId: string;
  lifecycleStatus: CompanyLifecycle;
}): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }

  try {
    const result = await CompanyWriteService.changeCompanyLifecycle(input, auth.actor);
    if (!result.ok) {
      return toActionResult(result);
    }
    revalidateCrm(result.data.companyId);
    return {
      ok: true,
      message: result.data.unchanged
        ? "Statut inchangé."
        : `Statut mis à jour : ${COMPANY_LIFECYCLE_LABELS[input.lifecycleStatus]}`,
      data: { companyId: result.data.companyId },
    };
  } catch (error) {
    logServerError("companies", error);
    return { ok: false, message: userFacingDbError() };
  }
}
