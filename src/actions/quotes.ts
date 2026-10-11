"use server";

import { logServerError } from "@/lib/observability/log-error";

import type { ActionResult } from "@/lib/crm/action-result";
import { requireActor } from "@/lib/crm/actor";
import { isOpenOpportunityStage } from "@/lib/crm/constants";
import { readString } from "@/lib/crm/form-data";
import { parisParts } from "@/lib/dates";
import { revalidateFollowUps, revalidateQuotes } from "@/lib/crm/revalidate";
import { prisma } from "@/lib/db/prisma";
import { applyOpportunityStageChange, type OpportunityStageTx } from "@/lib/services/opportunities/stage";
import { getAuthSecret } from "@/lib/auth/config";
import {
  SENSITIVE_CONFIRMATION_TTL_MS,
  signSensitiveIntent,
} from "@/lib/crm/sensitive-confirmation";
import {
  abandonAcceptedQuote,
  ABANDON_QUOTE_CONFIRMATION_MESSAGE,
} from "@/lib/services/quotes/abandon";
import {
  QuoteWorkflowAbort,
  scheduleQuoteFollowUp,
  updateQuoteStatus as updateQuoteStatusService,
  type QuoteFollowUpPreset,
} from "@/lib/services/quotes/status";
import { toActionResult } from "@/lib/services/_shared/result";
import {
  abandonAcceptedQuoteSchema,
  createQuoteSchema,
  fieldErrorsFromZod,
  updateQuoteStatusSchema,
} from "@/lib/validations/quote";

async function nextQuoteReference() {
  const year = parisParts(new Date()).year;
  const prefix = `DEV-${year}-`;
  const count = await prisma.quote.count({
    where: { reference: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(3, "0")}`;
}

export async function createQuote(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }
  const { actor } = auth;
  const parsed = createQuoteSchema.safeParse({
    companyId: readString(formData, "companyId"),
    opportunityId: readString(formData, "opportunityId"),
    reference: readString(formData, "reference"),
    amountIncTax: readString(formData, "amountIncTax"),
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
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: input.opportunityId },
    });

    if (!opportunity || opportunity.companyId !== input.companyId) {
      return { ok: false, message: "Opportunité introuvable pour cette entreprise." };
    }

    const reference = input.reference ?? (await nextQuoteReference());
    const shouldMoveToQuote =
      isOpenOpportunityStage(opportunity.stage) && opportunity.stage !== "QUOTE";

    const quote = await prisma.$transaction(async (tx) => {
      const created = await tx.quote.create({
        data: {
          companyId: opportunity.companyId,
          opportunityId: opportunity.id,
          reference,
          amountIncTax: input.amountIncTax,
          status: "DRAFT",
        },
      });

      if (shouldMoveToQuote) {
        const stageResult = await applyOpportunityStageChange(tx as unknown as OpportunityStageTx, {
          opportunityId: opportunity.id,
          stage: "QUOTE",
          lostReason: null,
          actorId: actor.id,
          now: new Date(),
          metadata: { quoteId: created.id },
        });
        if (!stageResult.ok) {
          throw new QuoteWorkflowAbort(stageResult.message);
        }
      }

      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          entityType: "Quote",
          entityId: created.id,
          action: "quote.created",
          metadata: {
            companyId: opportunity.companyId,
            opportunityId: opportunity.id,
            reference: created.reference,
            amountIncTax: input.amountIncTax,
          },
        },
      });

      return created;
    });

    revalidateQuotes(opportunity.companyId);
    return {
      ok: true,
      data: {
        quoteId: quote.id,
        companyId: opportunity.companyId,
        opportunityId: opportunity.id,
      },
    };
  } catch (error) {
    if (error instanceof QuoteWorkflowAbort) {
      return { ok: false, message: error.message };
    }
    logServerError("quotes", error);
    return { ok: false, message: "Impossible de créer le devis. Réessayez." };
  }
}

export async function updateQuoteStatus(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }
  const { actor } = auth;
  const parsed = updateQuoteStatusSchema.safeParse({
    quoteId: readString(formData, "quoteId"),
    status: readString(formData, "status"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Transition de statut invalide.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const input = parsed.data;

  try {
    const result = await updateQuoteStatusService(input, actor);
    if (!result.ok) {
      return toActionResult(result);
    }
    revalidateQuotes(result.data.companyId);
    const message = result.data.unchanged
      ? "Devis inchangé."
      : input.status === "ACCEPTED"
        ? result.data.becameClient
          ? `Devis accepté · ${result.data.companyName} est maintenant cliente`
          : "Devis accepté"
        : input.status === "SENT"
          ? "Devis envoyé"
          : input.status === "REJECTED"
            ? "Devis refusé"
            : "Devis mis à jour";
    return {
      ok: true,
      message,
      data: {
        quoteId: result.data.quoteId,
        companyId: result.data.companyId,
        opportunityId: result.data.opportunityId,
        companyName: result.data.companyName,
        proposeFollowUp: result.data.proposeFollowUp,
        offerProject: result.data.offerProject,
      },
    };
  } catch (error) {
    logServerError("quotes", error);
    return { ok: false, message: "Impossible de mettre à jour le devis. Réessayez." };
  }
}

export async function abandonQuote(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }
  const { actor } = auth;
  const parsed = abandonAcceptedQuoteSchema.safeParse({
    quoteId: readString(formData, "quoteId"),
    reason: readString(formData, "reason"),
    confirmationToken: readString(formData, "confirmationToken").trim() || null,
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Motif d'abandon requis (10 caractères minimum).",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  try {
    const secret = getAuthSecret();
    const result = await abandonAcceptedQuote(parsed.data, actor, { secret });
    if (!result.ok && result.code === "CONFIRMATION_REQUIRED") {
      const issuedToken = signSensitiveIntent(
        {
          kind: "quote-abandon",
          actorId: actor.id,
          quoteId: parsed.data.quoteId,
          reason: parsed.data.reason.trim(),
          exp: Date.now() + SENSITIVE_CONFIRMATION_TTL_MS,
        },
        secret,
      );
      return {
        ok: false,
        message: result.message || ABANDON_QUOTE_CONFIRMATION_MESSAGE,
        data: {
          confirmationToken: issuedToken,
          quoteId: parsed.data.quoteId,
        },
      };
    }
    if (!result.ok) {
      return toActionResult(result);
    }
    revalidateQuotes(result.data.companyId);
    return {
      ok: true,
      message:
        "Devis clôturé sans encaissement. Il sort du prévisionnel actif ; l'historique et les encaissements restent.",
      data: {
        quoteId: result.data.quoteId,
        companyId: result.data.companyId,
        projectId: result.data.projectId ?? undefined,
      },
    };
  } catch (error) {
    logServerError("quotes", error);
    return { ok: false, message: "Impossible de clôturer le devis. Réessayez." };
  }
}

export async function scheduleQuoteReminder(
  input: { quoteId: string; preset: QuoteFollowUpPreset; customDueDate?: string | null },
): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }

  try {
    const result = await scheduleQuoteFollowUp(input, auth.actor);
    if (!result.ok) {
      return toActionResult(result);
    }
    revalidateFollowUps(result.data.companyId);
    const due = new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      timeZone: "Europe/Paris",
    }).format(new Date(result.data.dueAt));
    return {
      ok: true,
      message: `Relance le ${due}`,
      data: { followUpId: result.data.followUpId, companyId: result.data.companyId, quoteId: input.quoteId },
    };
  } catch (error) {
    logServerError("quotes", error);
    return { ok: false, message: "Impossible de programmer la relance. Réessayez." };
  }
}
