import type { CompanyLifecycle, InteractionType, OpportunityStage, QuoteStatus } from "@/generated/prisma/client";
import { isOpenOpportunityStage, OPEN_OPPORTUNITY_STAGES, OPPORTUNITY_STAGE_LABELS } from "@/lib/crm/constants";
import { INTERACTION_TYPE_LABELS } from "@/lib/crm/labels";
import { dueBucket, formatDate, parisParts } from "@/lib/dates";
import { sumMoney, ZERO_MONEY } from "@/lib/money";
import type { ProjectSaleDraft } from "@/lib/projects/draft";
import { projectDraftFromSale } from "@/lib/projects/draft";

/** Fenêtre « créé récemment » pour un prospect sans échange. */
export const NEW_PROSPECT_DAYS = 14;
/** Inactivité affichée, jamais appelée « retard » : il n'y a pas d'échéance. */
export const STALE_OPPORTUNITY_DAYS = 7;

export const OPERATIONS_LIMITS = {
  today: 12,
  followUps: 8,
  quotes: 8,
  prospects: 8,
  opportunities: 8,
} as const;

export type OperationsFollowUp = {
  id: string;
  title: string;
  dueAt: string;
  status: "PENDING" | "COMPLETED" | "CANCELED";
  companyId: string;
  companyName: string;
  opportunityId: string | null;
  opportunityTitle: string | null;
  lastInteractionType: InteractionType | null;
  lastInteractionSubject: string | null;
};

export type OperationsQuote = {
  id: string;
  reference: string;
  status: QuoteStatus;
  amountIncTax: string;
  sentAt: string | null;
  acceptedAt: string | null;
  projectId: string | null;
  companyId: string;
  companyName: string;
  opportunityId: string;
  opportunityTitle: string;
};

export type OperationsProspect = {
  id: string;
  name: string;
  lifecycleStatus: CompanyLifecycle;
  createdAt: string;
  interactionCount: number;
};

export type OperationsOpportunity = {
  id: string;
  title: string;
  stage: OpportunityStage;
  estimatedValue: string;
  companyId: string;
  companyName: string;
  updatedAt: string;
  lastInteractionAt: string | null;
};

export type OperationsPipelineRow = {
  stage: OpportunityStage;
  count: number;
  estimatedValue: string;
};

export type OperationsInput = {
  followUps: OperationsFollowUp[];
  quotes: OperationsQuote[];
  prospects: OperationsProspect[];
  opportunities: OperationsOpportunity[];
  pipeline: OperationsPipelineRow[];
  activeProspects: number;
  /** Comptages SQL exacts. Sans eux, les KPI suivent les listes chargées. */
  exact?: {
    overdueFollowUps: number;
    todayFollowUps: number;
    waitingQuotes: number;
  };
};

export type WorkAction = {
  id: string;
  priority: 1 | 2 | 3 | 4 | 5;
  kind: "follow_up" | "accepted_quote" | "waiting_quote" | "new_prospect";
  companyId: string;
  companyName: string;
  title: string;
  context: string;
  whenLabel: string;
  urgency: "overdue" | "today" | "normal";
  followUpId: string | null;
  quoteId: string | null;
  projectDraft: ProjectSaleDraft | null;
};

export type FollowUpCard = {
  id: string;
  title: string;
  companyId: string;
  companyName: string;
  opportunityTitle: string | null;
  dueAt: string;
  whenLabel: string;
  context: string;
  bucket: "overdue" | "today" | "upcoming";
};

export type WaitingQuoteCard = {
  id: string;
  reference: string;
  companyId: string;
  companyName: string;
  opportunityTitle: string;
  amountIncTax: string;
  sentAt: string | null;
  ageLabel: string;
  followUpLabel: string | null;
  missingFollowUp: boolean;
};

export type AcceptedQuoteCard = {
  id: string;
  reference: string;
  companyId: string;
  companyName: string;
  amountIncTax: string;
  projectDraft: ProjectSaleDraft;
};

export type StaleOpportunityCard = {
  id: string;
  title: string;
  companyId: string;
  companyName: string;
  stageLabel: string;
  daysSinceActivity: number;
  estimatedValue: string;
};

export type PipelineColumn = {
  stage: OpportunityStage;
  label: string;
  count: number;
  estimatedValue: string;
};

export type OperationsDashboard = {
  today: WorkAction[];
  followUps: {
    overdue: FollowUpCard[];
    today: FollowUpCard[];
    upcoming: FollowUpCard[];
  };
  waitingQuotes: WaitingQuoteCard[];
  acceptedWithoutProject: AcceptedQuoteCard[];
  staleOpportunities: StaleOpportunityCard[];
  /** Prospects sans échange qui n'ont pas tenu dans la liste du jour. */
  moreProspects: WorkAction[];
  kpis: {
    activeProspects: number;
    overdueFollowUps: number;
    todayFollowUps: number;
    waitingQuotes: number;
    openOpportunities: number;
    pipelineEstimated: string;
  };
  pipeline: PipelineColumn[];
};

function civilIndex(value: Date | string) {
  const parts = parisParts(value);
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / 86_400_000);
}

function civilDaysSince(value: Date | string, now: Date) {
  return civilIndex(now) - civilIndex(value);
}

function interactionContext(type: InteractionType | null, subject: string | null) {
  if (!type) {
    return null;
  }
  const label =
    type in INTERACTION_TYPE_LABELS
      ? INTERACTION_TYPE_LABELS[type as keyof typeof INTERACTION_TYPE_LABELS]
      : "Échange";
  return subject ? `Dernier échange : ${label} · ${subject}` : `Dernier échange : ${label}`;
}

function coversQuote(followUp: OperationsFollowUp, quote: OperationsQuote) {
  if (followUp.companyId !== quote.companyId || followUp.status !== "PENDING") {
    return false;
  }
  return followUp.opportunityId === null || followUp.opportunityId === quote.opportunityId;
}

function earliestCoveringFollowUp(quote: OperationsQuote, pending: OperationsFollowUp[]) {
  const matches = pending
    .filter((followUp) => coversQuote(followUp, quote))
    .sort((left, right) => left.dueAt.localeCompare(right.dueAt));
  return matches[0] ?? null;
}

export function buildOperationsDashboard(input: OperationsInput, now = new Date()): OperationsDashboard {
  const pending = input.followUps.filter((followUp) => followUp.status === "PENDING");
  const followUpCards = {
    overdue: [] as FollowUpCard[],
    today: [] as FollowUpCard[],
    upcoming: [] as FollowUpCard[],
  };

  const sortedFollowUps = [...pending].sort((left, right) => left.dueAt.localeCompare(right.dueAt));
  for (const followUp of sortedFollowUps) {
    const bucket = dueBucket(new Date(followUp.dueAt), now);
    followUpCards[bucket].push({
      id: followUp.id,
      title: followUp.title,
      companyId: followUp.companyId,
      companyName: followUp.companyName,
      opportunityTitle: followUp.opportunityTitle,
      dueAt: followUp.dueAt,
      whenLabel: formatDate(followUp.dueAt),
      context:
        interactionContext(followUp.lastInteractionType, followUp.lastInteractionSubject) ??
        followUp.opportunityTitle ??
        "Relance programmée",
      bucket,
    });
  }

  const todayActions: WorkAction[] = [];

  for (const card of followUpCards.overdue) {
    todayActions.push({
      id: `follow-up:${card.id}`,
      priority: 1,
      kind: "follow_up",
      companyId: card.companyId,
      companyName: card.companyName,
      title: "Relance en retard",
      context: card.title,
      whenLabel: card.whenLabel,
      urgency: "overdue",
      followUpId: card.id,
      quoteId: null,
      projectDraft: null,
    });
  }
  for (const card of followUpCards.today) {
    todayActions.push({
      id: `follow-up:${card.id}`,
      priority: 2,
      kind: "follow_up",
      companyId: card.companyId,
      companyName: card.companyName,
      title: "Relance prévue aujourd'hui",
      context: card.context,
      whenLabel: card.whenLabel,
      urgency: "today",
      followUpId: card.id,
      quoteId: null,
      projectDraft: null,
    });
  }

  const acceptedWithoutProject: AcceptedQuoteCard[] = [];
  const waitingQuotes: WaitingQuoteCard[] = [];
  const quotes = [...input.quotes].sort((left, right) => (left.sentAt ?? left.acceptedAt ?? "").localeCompare(right.sentAt ?? right.acceptedAt ?? ""));

  for (const quote of quotes) {
    if (quote.status === "ACCEPTED") {
      if (quote.projectId) {
        continue;
      }
      const draft = projectDraftFromSale({
        companyId: quote.companyId,
        companyName: quote.companyName,
        opportunityTitle: quote.opportunityTitle,
        quoteAmountIncTax: quote.amountIncTax,
        quoteId: quote.id,
      });
      acceptedWithoutProject.push({
        id: quote.id,
        reference: quote.reference,
        companyId: quote.companyId,
        companyName: quote.companyName,
        amountIncTax: quote.amountIncTax,
        projectDraft: draft,
      });
      todayActions.push({
        id: `accepted:${quote.id}`,
        priority: 3,
        kind: "accepted_quote",
        companyId: quote.companyId,
        companyName: quote.companyName,
        title: "Devis accepté — projet à créer",
        context: `${quote.reference}`,
        whenLabel: quote.amountIncTax,
        urgency: "normal",
        followUpId: null,
        quoteId: quote.id,
        projectDraft: draft,
      });
      continue;
    }

    if (quote.status !== "SENT" && quote.status !== "VIEWED") {
      continue;
    }

    const cover = earliestCoveringFollowUp(quote, pending);
    const sentAt = quote.sentAt ?? quote.acceptedAt;
    const ageDays = sentAt ? civilDaysSince(sentAt, now) : 0;
    waitingQuotes.push({
      id: quote.id,
      reference: quote.reference,
      companyId: quote.companyId,
      companyName: quote.companyName,
      opportunityTitle: quote.opportunityTitle,
      amountIncTax: quote.amountIncTax,
      sentAt,
      ageLabel: ageDays <= 0 ? "Envoyé aujourd'hui" : `Envoyé il y a ${ageDays} jour${ageDays > 1 ? "s" : ""}`,
      followUpLabel: cover ? `Relance le ${formatDate(cover.dueAt)}` : null,
      missingFollowUp: !cover,
    });
    if (!cover) {
      todayActions.push({
        id: `waiting:${quote.id}`,
        priority: 4,
        kind: "waiting_quote",
        companyId: quote.companyId,
        companyName: quote.companyName,
        title: quote.status === "VIEWED" ? "Devis consulté — sans relance" : "Devis envoyé — sans relance",
        context: "Pas de relance programmée",
        whenLabel: quote.reference,
        urgency: "normal",
        followUpId: null,
        quoteId: quote.id,
        projectDraft: null,
      });
    }
  }

  for (const prospect of input.prospects) {
    if (prospect.lifecycleStatus !== "LEAD" || prospect.interactionCount > 0) {
      continue;
    }
    if (pending.some((followUp) => followUp.companyId === prospect.id)) {
      continue;
    }
    const recent = civilDaysSince(prospect.createdAt, now) <= NEW_PROSPECT_DAYS;
    todayActions.push({
      id: `prospect:${prospect.id}`,
      priority: 5,
      kind: "new_prospect",
      companyId: prospect.id,
      companyName: prospect.name,
      title: recent ? "Nouveau prospect" : "Prospect sans échange",
      context: "Aucun échange enregistré",
      whenLabel: formatDate(prospect.createdAt),
      urgency: "normal",
      followUpId: null,
      quoteId: null,
      projectDraft: null,
    });
  }

  todayActions.sort((left, right) => left.priority - right.priority);

  const coveredOpportunityIds = new Set<string>();
  for (const followUp of pending) {
    if (followUp.opportunityId) {
      coveredOpportunityIds.add(followUp.opportunityId);
    }
  }
  for (const quote of waitingQuotes) {
    const source = input.quotes.find((item) => item.id === quote.id);
    if (source) {
      coveredOpportunityIds.add(source.opportunityId);
    }
  }

  const staleOpportunities: StaleOpportunityCard[] = [];
  for (const opportunity of input.opportunities) {
    if (!isOpenOpportunityStage(opportunity.stage)) {
      continue;
    }
    if (coveredOpportunityIds.has(opportunity.id)) {
      continue;
    }
    if (pending.some((followUp) => followUp.opportunityId === null && followUp.companyId === opportunity.companyId)) {
      continue;
    }
    const last = opportunity.lastInteractionAt ?? opportunity.updatedAt;
    const days = civilDaysSince(last, now);
    if (days < STALE_OPPORTUNITY_DAYS) {
      continue;
    }
    staleOpportunities.push({
      id: opportunity.id,
      title: opportunity.title,
      companyId: opportunity.companyId,
      companyName: opportunity.companyName,
      stageLabel: OPPORTUNITY_STAGE_LABELS[opportunity.stage],
      daysSinceActivity: days,
      estimatedValue: opportunity.estimatedValue,
    });
  }
  staleOpportunities.sort((left, right) => right.daysSinceActivity - left.daysSinceActivity);

  const pipeline: PipelineColumn[] = OPEN_OPPORTUNITY_STAGES.map((stage) => {
    const row = input.pipeline.find((item) => item.stage === stage);
    return {
      stage,
      label: OPPORTUNITY_STAGE_LABELS[stage],
      count: row?.count ?? 0,
      estimatedValue: row?.estimatedValue ?? ZERO_MONEY,
    };
  });

  const pipelineEstimated = sumMoney(pipeline.map((column) => column.estimatedValue));
  const openOpportunities = pipeline.reduce((sum, column) => sum + column.count, 0);

  const today = todayActions.slice(0, OPERATIONS_LIMITS.today);
  const shownProspects = new Set(
    today.flatMap((action) => (action.kind === "new_prospect" ? [action.id] : [])),
  );

  return {
    today,
    followUps: {
      overdue: followUpCards.overdue.slice(0, 40),
      today: followUpCards.today.slice(0, 40),
      upcoming: followUpCards.upcoming.slice(0, 40),
    },
    waitingQuotes: waitingQuotes.slice(0, OPERATIONS_LIMITS.quotes),
    acceptedWithoutProject: acceptedWithoutProject.slice(0, OPERATIONS_LIMITS.quotes),
    staleOpportunities: staleOpportunities.slice(0, OPERATIONS_LIMITS.opportunities),
    moreProspects: todayActions
      .filter((action) => action.kind === "new_prospect" && !shownProspects.has(action.id))
      .slice(0, OPERATIONS_LIMITS.prospects),
    kpis: {
      activeProspects: input.activeProspects,
      overdueFollowUps: input.exact?.overdueFollowUps ?? followUpCards.overdue.length,
      todayFollowUps: input.exact?.todayFollowUps ?? followUpCards.today.length,
      waitingQuotes: input.exact?.waitingQuotes ?? waitingQuotes.length,
      openOpportunities,
      pipelineEstimated,
    },
    pipeline,
  };
}
