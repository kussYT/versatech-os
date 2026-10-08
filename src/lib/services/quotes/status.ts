import "server-only";

import type { CompanyLifecycle, OpportunityStage, QuoteStatus } from "@/generated/prisma/client";
import type { SessionUser } from "@/lib/auth/types";
import { followUpDueAtAfterCivilDays, followUpDueAtOnCivilDate } from "@/lib/dates";
import { createFollowUp, type FollowUpWriteStore } from "@/lib/services/follow-ups/write";
import {
  applyOpportunityStageChange,
  type OpportunityStageTx,
} from "@/lib/services/opportunities/stage";
import { serviceFail, serviceOk, type ServiceResult } from "@/lib/services/_shared/result";
import { updateQuoteStatusSchema } from "@/lib/validations/quote";

const ALLOWED_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  DRAFT: ["SENT"],
  SENT: ["VIEWED", "ACCEPTED", "REJECTED"],
  VIEWED: ["ACCEPTED", "REJECTED"],
  ACCEPTED: [],
  REJECTED: [],
  EXPIRED: [],
};

export class QuoteWorkflowAbort extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuoteWorkflowAbort";
  }
}

type QuoteRow = {
  id: string;
  companyId: string;
  opportunityId: string;
  projectId: string | null;
  reference: string;
  amountIncTax: string;
  status: QuoteStatus;
  sentAt: Date | null;
  acceptedAt: Date | null;
  company: { id: string; name: string; lifecycleStatus: CompanyLifecycle };
  opportunity: { id: string; stage: OpportunityStage };
};

export type QuoteStatusTx = OpportunityStageTx & {
  quote: OpportunityStageTx["quote"] & {
    findUnique: (args: {
      where: { id: string };
      include: { opportunity: true; company: true };
    }) => Promise<QuoteRow | null>;
    update: (args: {
      where: { id: string };
      data: { status: QuoteStatus; sentAt?: Date; acceptedAt?: Date };
    }) => Promise<unknown>;
  };
};

export type QuoteStatusStore = {
  $transaction: <T>(fn: (tx: QuoteStatusTx) => Promise<T>) => Promise<T>;
};

export type QuoteFollowUpPreset = "tomorrow" | "in3Days" | "in1Week" | "custom";

export type UpdateQuoteStatusResult = {
  quoteId: string;
  companyId: string;
  opportunityId: string;
  companyName: string;
  status: QuoteStatus;
  unchanged: boolean;
  proposeFollowUp: boolean;
  offerProject: boolean;
  becameClient: boolean;
};

function statusDates(status: QuoteStatus, now: Date) {
  if (status === "SENT") {
    return { sentAt: now };
  }
  if (status === "ACCEPTED") {
    return { acceptedAt: now };
  }
  return {};
}

export function quoteFollowUpTitle(reference: string) {
  return `Relancer — devis ${reference}`;
}

/**
 * Autorise la transition de devis, puis exécute Gagné via le service d'étape
 * dans la même transaction. L'acceptation est l'intention : pas de jeton Gagné.
 * Un devis refusé ne perd ni l'opportunité ni l'entreprise. Aucun projet n'est créé.
 */
export async function updateQuoteStatus(
  input: { quoteId: string; status: QuoteStatus },
  actor: SessionUser,
  deps: { store?: QuoteStatusStore; now?: Date } = {},
): Promise<ServiceResult<UpdateQuoteStatusResult>> {
  if (!actor?.id) {
    return serviceFail("AUTH_REQUIRED", "Authentification requise.");
  }

  const parsed = updateQuoteStatusSchema.safeParse(input);
  if (!parsed.success) {
    return serviceFail("VALIDATION", "Transition de statut invalide.");
  }

  const now = deps.now ?? new Date();
  const store = await resolveStore(deps.store);
  try {
    return await store.$transaction(async (tx) => {
      const existing = await tx.quote.findUnique({
        where: { id: parsed.data.quoteId },
        include: { opportunity: true, company: true },
      });
      if (!existing) {
        return serviceFail("NOT_FOUND", "Devis introuvable.");
      }

      if (existing.status === parsed.data.status) {
        return serviceOk({
          quoteId: existing.id,
          companyId: existing.companyId,
          opportunityId: existing.opportunityId,
          companyName: existing.company.name,
          status: existing.status,
          unchanged: true,
          proposeFollowUp: false,
          offerProject: existing.status === "ACCEPTED" && !existing.projectId,
          becameClient: false,
        });
      }

      if (!ALLOWED_TRANSITIONS[existing.status].includes(parsed.data.status)) {
        return serviceFail("VALIDATION", "Cette transition n'est pas autorisée.");
      }

      await tx.quote.update({
        where: { id: existing.id },
        data: {
          status: parsed.data.status,
          ...statusDates(parsed.data.status, now),
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
            reference: existing.reference,
            amountIncTax: existing.amountIncTax,
            fromStatus: existing.status,
            toStatus: parsed.data.status,
          },
        },
      });

      let becameClient = false;
      if (parsed.data.status === "ACCEPTED") {
        const stageResult = await applyOpportunityStageChange(tx, {
          opportunityId: existing.opportunityId,
          stage: "WON",
          lostReason: null,
          actorId: actor.id,
          now,
          metadata: { quoteId: existing.id },
        });
        if (!stageResult.ok) {
          throw new QuoteWorkflowAbort(stageResult.message);
        }
        becameClient = stageResult.data.lifecycleTo === "CLIENT";
      }

      return serviceOk({
        quoteId: existing.id,
        companyId: existing.companyId,
        opportunityId: existing.opportunityId,
        companyName: existing.company.name,
        status: parsed.data.status,
        unchanged: false,
        proposeFollowUp: parsed.data.status === "SENT",
        offerProject: parsed.data.status === "ACCEPTED" && !existing.projectId,
        becameClient,
      });
    });
  } catch (error) {
    if (error instanceof QuoteWorkflowAbort) {
      return serviceFail("DEPENDENCY", error.message);
    }
    throw error;
  }
}

type QuoteFollowUpRow = {
  id: string;
  status: QuoteStatus;
  companyId: string;
  opportunityId: string;
  reference: string;
};

export async function scheduleQuoteFollowUp(
  input: {
    quoteId: string;
    preset: QuoteFollowUpPreset;
    customDueDate?: string | null;
  },
  actor: SessionUser,
  deps: {
    now?: Date;
    quote?: {
      findUnique: (args: { where: { id: string } }) => Promise<QuoteFollowUpRow | null>;
    };
    followUps?: FollowUpWriteStore;
  } = {},
): Promise<ServiceResult<{ followUpId: string; companyId: string; dueAt: string }>> {
  if (!actor?.id) {
    return serviceFail("AUTH_REQUIRED", "Authentification requise.");
  }

  const now = deps.now ?? new Date();
  const dueAt =
    input.preset === "custom"
      ? followUpDueAtOnCivilDate(input.customDueDate ?? "")
      : followUpDueAtAfterCivilDays(input.preset === "tomorrow" ? 1 : input.preset === "in3Days" ? 3 : 7, now);
  if (!dueAt) {
    return serviceFail("VALIDATION", "Date de relance invalide.");
  }

  const quoteStore = deps.quote ?? (await resolveReadQuote());
  const quote = await quoteStore.findUnique({ where: { id: input.quoteId } });
  if (!quote) {
    return serviceFail("NOT_FOUND", "Devis introuvable.");
  }
  if (quote.status !== "SENT" && quote.status !== "VIEWED") {
    return serviceFail("VALIDATION", "La relance se programme après l'envoi du devis.");
  }

  const created = await createFollowUp(
    {
      actor,
      companyId: quote.companyId,
      dueAt,
      title: quoteFollowUpTitle(quote.reference),
      opportunityId: quote.opportunityId,
      activityMetadata: {
        quoteId: quote.id,
        dueAt: dueAt.toISOString(),
      },
    },
    { store: deps.followUps, now },
  );
  if (!created.ok) {
    return created;
  }
  return serviceOk({
    followUpId: created.data.followUpId,
    companyId: created.data.companyId,
    dueAt: dueAt.toISOString(),
  });
}

async function resolveStore(store?: QuoteStatusStore): Promise<QuoteStatusStore> {
  if (store) {
    return store;
  }
  const { prisma } = await import("@/lib/db/prisma");
  return prisma as unknown as QuoteStatusStore;
}

async function resolveReadQuote() {
  const { prisma } = await import("@/lib/db/prisma");
  return {
    findUnique: (args: { where: { id: string } }) =>
      prisma.quote.findUnique({
        where: args.where,
        select: {
          id: true,
          status: true,
          companyId: true,
          opportunityId: true,
          reference: true,
        },
      }),
  };
}
