"use server";

import type { CompanyLifecycle, QuoteStatus } from "@/generated/prisma/client";
import type { ActionResult } from "@/lib/crm/action-result";
import { requireActor } from "@/lib/crm/actor";
import { isOpenOpportunityStage } from "@/lib/crm/constants";
import { readString } from "@/lib/crm/form-data";
import { parisParts } from "@/lib/dates";
import { revalidateQuotes } from "@/lib/crm/revalidate";
import { prisma } from "@/lib/db/prisma";
import {
  createQuoteSchema,
  fieldErrorsFromZod,
  updateQuoteStatusSchema,
} from "@/lib/validations/quote";

const ALLOWED_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  DRAFT: ["SENT"],
  SENT: ["VIEWED", "ACCEPTED", "REJECTED"],
  VIEWED: ["ACCEPTED", "REJECTED"],
  ACCEPTED: [],
  REJECTED: [],
  EXPIRED: [],
};

function lifecycleAfterWon(current: CompanyLifecycle): CompanyLifecycle | null {
  return current === "CLIENT" ? null : "CLIENT";
}

function quoteStatusDates(status: QuoteStatus) {
  if (status === "SENT") {
    return { sentAt: new Date() };
  }

  if (status === "ACCEPTED") {
    return { acceptedAt: new Date() };
  }

  return {};
}

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
        await tx.opportunity.update({
          where: { id: opportunity.id },
          data: { stage: "QUOTE" },
        });

        await tx.opportunityStageHistory.create({
          data: {
            opportunityId: opportunity.id,
            fromStage: opportunity.stage,
            toStage: "QUOTE",
            changedById: actor.id,
          },
        });

        await tx.activityLog.create({
          data: {
            actorId: actor.id,
            entityType: "Opportunity",
            entityId: opportunity.id,
            action: "opportunity.stage_changed",
            metadata: {
              companyId: opportunity.companyId,
              fromStage: opportunity.stage,
              toStage: "QUOTE",
              quoteId: created.id,
            },
          },
        });
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
    console.error(error);
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
    const existing = await prisma.quote.findUnique({
      where: { id: input.quoteId },
      include: {
        opportunity: true,
        company: true,
      },
    });

    if (!existing) {
      return { ok: false, message: "Devis introuvable." };
    }

    if (existing.status === input.status) {
      return {
        ok: true,
        data: { quoteId: existing.id, companyId: existing.companyId },
      };
    }

    if (!ALLOWED_TRANSITIONS[existing.status].includes(input.status)) {
      return { ok: false, message: "Cette transition n'est pas autorisée." };
    }

    const shouldWinOpportunity = input.status === "ACCEPTED" && existing.opportunity.stage !== "WON";
    const nextLifecycle = shouldWinOpportunity
      ? lifecycleAfterWon(existing.company.lifecycleStatus)
      : null;

    await prisma.$transaction(async (tx) => {
      await tx.quote.update({
        where: { id: existing.id },
        data: {
          status: input.status,
          ...quoteStatusDates(input.status),
        },
      });

      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          entityType: "Quote",
          entityId: existing.id,
          action: "quote.status_changed",
          metadata: {
            companyId: existing.companyId,
            opportunityId: existing.opportunityId,
            fromStatus: existing.status,
            toStatus: input.status,
          },
        },
      });

      if (shouldWinOpportunity) {
        await tx.opportunity.update({
          where: { id: existing.opportunityId },
          data: {
            stage: "WON",
            wonAt: existing.opportunity.wonAt ?? new Date(),
          },
        });

        await tx.opportunityStageHistory.create({
          data: {
            opportunityId: existing.opportunityId,
            fromStage: existing.opportunity.stage,
            toStage: "WON",
            changedById: actor.id,
          },
        });

        await tx.activityLog.create({
          data: {
            actorId: actor.id,
            entityType: "Opportunity",
            entityId: existing.opportunityId,
            action: "opportunity.stage_changed",
            metadata: {
              companyId: existing.companyId,
              fromStage: existing.opportunity.stage,
              toStage: "WON",
              quoteId: existing.id,
            },
          },
        });
      }

      if (nextLifecycle) {
        await tx.company.update({
          where: { id: existing.companyId },
          data: { lifecycleStatus: nextLifecycle },
        });
      }
    });

    revalidateQuotes(existing.companyId);
    return {
      ok: true,
      data: {
        quoteId: existing.id,
        companyId: existing.companyId,
        opportunityId: existing.opportunityId,
      },
    };
  } catch (error) {
    console.error(error);
    return { ok: false, message: "Impossible de mettre à jour le devis. Réessayez." };
  }
}
