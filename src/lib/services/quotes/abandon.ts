import "server-only";

import type { PaymentStatus, ProjectStatus, QuoteStatus } from "@/generated/prisma/client";
import type { SessionUser } from "@/lib/auth/types";
import { verifySensitiveIntent } from "@/lib/crm/sensitive-confirmation";
import { prisma } from "@/lib/db/prisma";
import { serviceFail, serviceOk, type ServiceResult } from "@/lib/services/_shared/result";
import { abandonAcceptedQuoteSchema } from "@/lib/validations/quote";

const ABANDONABLE_PROJECT: ReadonlySet<ProjectStatus> = new Set([
  "PLANNED",
  "ACTIVE",
  "WAITING_CLIENT",
  "REVIEW",
]);

const CANCELABLE_PAYMENT: ReadonlySet<PaymentStatus> = new Set(["PENDING", "OVERDUE"]);

export const ABANDON_QUOTE_CONFIRMATION_MESSAGE =
  "Confirmez la clôture sans encaissement : le devis sortira du prévisionnel actif. Les paiements déjà encaissés restent comptabilisés.";

export type AbandonAcceptedQuoteResult = {
  quoteId: string;
  companyId: string;
  projectId: string | null;
  canceledPaymentIds: string[];
};

/**
 * Clôture un devis ACCEPTED sans encaissement futur.
 * - Devis → ABANDONED (hors CA signé actif / signé non encaissé).
 * - Échéances PENDING/OVERDUE liées → CANCELED (jamais les PAID).
 * - Projet lié non livré → ABANDONED.
 */
export async function abandonAcceptedQuote(
  input: {
    quoteId: string;
    reason: string;
    confirmationToken?: string | null;
  },
  actor: SessionUser,
  deps: { secret?: string; now?: Date } = {},
): Promise<ServiceResult<AbandonAcceptedQuoteResult>> {
  if (!actor?.id) {
    return serviceFail("AUTH_REQUIRED", "Authentification requise.");
  }

  const parsed = abandonAcceptedQuoteSchema.safeParse(input);
  if (!parsed.success) {
    return serviceFail("VALIDATION", "Motif d'abandon requis (10 caractères minimum).");
  }

  const now = deps.now ?? new Date();
  const secret = deps.secret ?? "";
  const reason = parsed.data.reason.trim();

  const quote = await prisma.quote.findUnique({
    where: { id: parsed.data.quoteId },
    include: {
      project: true,
      payments: { select: { id: true, status: true } },
    },
  });

  if (!quote) {
    return serviceFail("NOT_FOUND", "Devis introuvable.");
  }

  if (quote.status === "ABANDONED") {
    return serviceOk({
      quoteId: quote.id,
      companyId: quote.companyId,
      projectId: quote.projectId,
      canceledPaymentIds: [],
    });
  }

  if (quote.status !== "ACCEPTED") {
    return serviceFail(
      "VALIDATION",
      "Seuls les devis acceptés peuvent être clôturés sans encaissement.",
    );
  }

  const allowed = secret
    ? verifySensitiveIntent(
        parsed.data.confirmationToken,
        {
          kind: "quote-abandon",
          actorId: actor.id,
          quoteId: quote.id,
          reason,
        },
        secret,
        now,
      )
    : false;

  if (!allowed) {
    return serviceFail("CONFIRMATION_REQUIRED", ABANDON_QUOTE_CONFIRMATION_MESSAGE);
  }

  const cancelIds = quote.payments
    .filter((payment) => CANCELABLE_PAYMENT.has(payment.status))
    .map((payment) => payment.id);

  const projectId =
    quote.projectId && quote.project && ABANDONABLE_PROJECT.has(quote.project.status)
      ? quote.projectId
      : null;

  await prisma.$transaction(async (tx) => {
    await tx.quote.update({
      where: { id: quote.id },
      data: {
        status: "ABANDONED" satisfies QuoteStatus,
        abandonedAt: now,
        abandonReason: reason,
      },
    });

    if (cancelIds.length > 0) {
      await tx.payment.updateMany({
        where: { id: { in: cancelIds } },
        data: { status: "CANCELED" },
      });
      for (const paymentId of cancelIds) {
        await tx.activityLog.create({
          data: {
            actorId: actor.id,
            entityType: "Payment",
            entityId: paymentId,
            action: "payment.status_changed",
            metadata: {
              companyId: quote.companyId,
              quoteId: quote.id,
              toStatus: "CANCELED",
              reason: "abandon_quote",
            },
          },
        });
      }
    }

    if (projectId) {
      await tx.project.update({
        where: { id: projectId },
        data: {
          status: "ABANDONED",
          abandonedAt: now,
          abandonReason: reason,
        },
      });
      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          entityType: "Project",
          entityId: projectId,
          action: "project.status_changed",
          metadata: {
            companyId: quote.companyId,
            toStatus: "ABANDONED",
            reason,
            quoteId: quote.id,
          },
        },
      });
    }

    await tx.activityLog.create({
      data: {
        actorId: actor.id,
        entityType: "Quote",
        entityId: quote.id,
        action: "quote.abandoned",
        metadata: {
          companyId: quote.companyId,
          opportunityId: quote.opportunityId,
          projectId: quote.projectId,
          reference: quote.reference,
          amountIncTax: String(quote.amountIncTax),
          reason,
          canceledPaymentCount: cancelIds.length,
        },
      },
    });
  });

  return serviceOk({
    quoteId: quote.id,
    companyId: quote.companyId,
    projectId: quote.projectId,
    canceledPaymentIds: cancelIds,
  });
}
