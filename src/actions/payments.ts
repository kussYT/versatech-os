"use server";

import { logServerError } from "@/lib/observability/log-error";

import type { ActionResult } from "@/lib/crm/action-result";
import { requireActor } from "@/lib/crm/actor";
import { readString } from "@/lib/crm/form-data";
import { revalidateFinances } from "@/lib/crm/revalidate";
import { PAYMENT_STATUS_TRANSITIONS, persistPaymentStatus, quotePaymentCapacity } from "@/lib/finance";
import { prisma } from "@/lib/db/prisma";
import {
  createPaymentSchema,
  fieldErrorsFromZod,
  updatePaymentStatusSchema,
} from "@/lib/validations/payment";
import type { PaymentStatus } from "@/generated/prisma/client";

export async function createPayment(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }
  const { actor } = auth;

  const parsed = createPaymentSchema.safeParse({
    companyId: readString(formData, "companyId"),
    quoteId: readString(formData, "quoteId"),
    projectId: readString(formData, "projectId"),
    label: readString(formData, "label"),
    amount: readString(formData, "amount"),
    status: readString(formData, "status"),
    dueAt: readString(formData, "dueAt"),
    paidAt: readString(formData, "paidAt"),
    externalReference: readString(formData, "externalReference"),
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
      select: { id: true },
    });

    if (!company) {
      return { ok: false, message: "Entreprise introuvable." };
    }

    const quote = input.quoteId
      ? await prisma.quote.findUnique({ where: { id: input.quoteId } })
      : null;

    if (input.quoteId && (!quote || quote.companyId !== company.id)) {
      return { ok: false, message: "Devis introuvable pour cette entreprise." };
    }

    if (quote && quote.status !== "ACCEPTED") {
      return { ok: false, message: "Un paiement ne se rattache qu'à un devis accepté." };
    }

    const projectId = input.projectId ?? quote?.projectId ?? null;
    const project = projectId
      ? await prisma.project.findUnique({ where: { id: projectId } })
      : null;

    if (projectId && (!project || project.companyId !== company.id)) {
      return { ok: false, message: "Projet introuvable pour cette entreprise." };
    }

    if (quote?.projectId && projectId && quote.projectId !== projectId) {
      return { ok: false, message: "Ce devis est déjà lié à un autre projet." };
    }

    if (quote) {
      const existingQuotePayments = await prisma.payment.findMany({
        where: { quoteId: quote.id },
        select: { amount: true, status: true },
      });
      const capacity = quotePaymentCapacity(
        quote.amountIncTax.toString(),
        existingQuotePayments.map((payment) => ({
          amount: payment.amount.toString(),
          status: payment.status,
        })),
        input.amount,
      );
      if (capacity.exceeds) {
        return {
          ok: false,
          message: `Ce paiement dépasse le montant TTC du devis (${quote.amountIncTax.toString()} €). Restant : ${capacity.remaining} €.`,
        };
      }
    }

    const now = new Date();
    const status = persistPaymentStatus(input.status, input.dueAt, now);
    const paidAt = status === "PAID" ? (input.paidAt ?? now) : null;

    const payment = await prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          companyId: company.id,
          quoteId: quote?.id ?? null,
          projectId: project?.id ?? null,
          label: input.label,
          amount: input.amount,
          status,
          dueAt: input.dueAt,
          paidAt,
          externalReference: input.externalReference,
        },
      });

      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          entityType: "Payment",
          entityId: created.id,
          action: "payment.created",
          metadata: {
            companyId: company.id,
            quoteId: quote?.id ?? null,
            projectId: project?.id ?? null,
            amount: input.amount,
            status,
            label: created.label,
          },
        },
      });

      return created;
    });

    revalidateFinances(company.id, project?.id);
    return {
      ok: true,
      data: {
        paymentId: payment.id,
        companyId: company.id,
        projectId: project?.id,
        quoteId: quote?.id,
      },
    };
  } catch (error) {
    logServerError("payments", error);
    return { ok: false, message: "Impossible d'enregistrer le paiement. Réessayez." };
  }
}

export async function updatePaymentStatus(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }
  const { actor } = auth;

  const parsed = updatePaymentStatusSchema.safeParse({
    paymentId: readString(formData, "paymentId"),
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
    const existing = await prisma.payment.findUnique({
      where: { id: input.paymentId },
    });

    if (!existing) {
      return { ok: false, message: "Paiement introuvable." };
    }

    if (existing.status === input.status) {
      return {
        ok: true,
        data: {
          paymentId: existing.id,
          companyId: existing.companyId,
          projectId: existing.projectId ?? undefined,
          quoteId: existing.quoteId ?? undefined,
        },
      };
    }

    if (!PAYMENT_STATUS_TRANSITIONS[existing.status].includes(input.status)) {
      return { ok: false, message: "Cette transition n'est pas autorisée." };
    }

    const now = new Date();
    const nextStatus: PaymentStatus =
      input.status === "PENDING"
        ? persistPaymentStatus("PENDING", existing.dueAt, now)
        : input.status;
    const paidAt =
      nextStatus === "PAID" ? (existing.paidAt ?? now) : existing.paidAt;

    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: existing.id },
        data: {
          status: nextStatus,
          paidAt,
        },
      });

      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          entityType: "Payment",
          entityId: existing.id,
          action: nextStatus === "PAID" ? "payment.marked_paid" : "payment.status_changed",
          metadata: {
            companyId: existing.companyId,
            quoteId: existing.quoteId,
            projectId: existing.projectId,
            fromStatus: existing.status,
            toStatus: nextStatus,
            amount: existing.amount.toString(),
          },
        },
      });
    });

    revalidateFinances(existing.companyId, existing.projectId ?? undefined);
    return {
      ok: true,
      data: {
        paymentId: existing.id,
        companyId: existing.companyId,
        projectId: existing.projectId ?? undefined,
        quoteId: existing.quoteId ?? undefined,
      },
    };
  } catch (error) {
    logServerError("payments", error);
    return { ok: false, message: "Impossible de mettre à jour le paiement. Réessayez." };
  }
}
