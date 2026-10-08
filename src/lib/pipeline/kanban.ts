import type { OpportunityStage } from "@/generated/prisma/client";
import { isOpenOpportunityStage, OPEN_OPPORTUNITY_STAGES, OPPORTUNITY_STAGES } from "@/lib/crm/constants";
import { dueBucket, followUpDueAtAfterCivilDays, followUpDueAtOnCivilDate, formatDate, parisDateKey } from "@/lib/dates";
import { centsToMoneyString, subtractMoney, sumMoney, tryParseMoneyToCents, ZERO_MONEY } from "@/lib/money";

/** Cartes chargées par colonne. Le compteur SQL reste la vérité du total. */
export const KANBAN_PAGE_SIZE = 40;

export type KanbanFilter = "all" | "active" | "won" | "lost";

export type KanbanFollowUpPreset = "tomorrow" | "in3Days" | "in1Week" | "custom";

export type ColumnTally = {
  stage: OpportunityStage;
  count: number;
  estimatedValue: string;
};

export type CardLock =
  | {
      kind: "optimistic";
      from: OpportunityStage;
      to: OpportunityStage;
      generation: number;
    }
  | {
      kind: "confirm";
      from: OpportunityStage;
      to: "WON" | "LOST";
      generation: number;
      lostReason: string;
      token: string | null;
    };

export type BoardCard = {
  id: string;
  stage: OpportunityStage;
  generation: number;
  lock: CardLock | null;
};

export type KanbanMoves = {
  cards: BoardCard[];
  error: string | null;
};

export type StageRequest =
  | { status: "ignored" }
  | { status: "blocked" }
  | { status: "confirm"; state: KanbanMoves }
  | {
      status: "submit";
      state: KanbanMoves;
      opportunityId: string;
      stage: OpportunityStage;
      lostReason: string;
      confirmationToken: string | null;
      generation: number;
    };

const FILTER_STAGES: Record<KanbanFilter, readonly OpportunityStage[]> = {
  all: OPPORTUNITY_STAGES,
  active: OPEN_OPPORTUNITY_STAGES,
  won: ["WON"],
  lost: ["LOST"],
};

export function stagesForFilter(filter: KanbanFilter) {
  return FILTER_STAGES[filter];
}

export function createMoves(cards: { id: string; stage: OpportunityStage }[]): KanbanMoves {
  return {
    cards: cards.map((card) => ({
      id: card.id,
      stage: card.stage,
      generation: 0,
      lock: null,
    })),
    error: null,
  };
}

function replaceCard(state: KanbanMoves, id: string, next: BoardCard): KanbanMoves {
  return {
    error: state.error,
    cards: state.cards.map((card) => (card.id === id ? next : card)),
  };
}

/**
 * Une carte verrouillée ignore les déplacements suivants.
 * La génération empêche une réponse ancienne d'écraser un déplacement plus récent.
 * Gagné et Perdu ne déplacent pas la carte : ils ouvrent la confirmation.
 */
export function requestStageChange(state: KanbanMoves, opportunityId: string, to: OpportunityStage): StageRequest {
  const card = state.cards.find((item) => item.id === opportunityId);
  if (!card || card.stage === to) {
    return { status: "ignored" };
  }
  if (card.lock) {
    return { status: "blocked" };
  }

  const generation = card.generation + 1;
  if (to === "WON" || to === "LOST") {
    return {
      status: "confirm",
      state: replaceCard(state, opportunityId, {
        ...card,
        generation,
        lock: {
          kind: "confirm",
          from: card.stage,
          to,
          generation,
          lostReason: "",
          token: null,
        },
      }),
    };
  }

  return {
    status: "submit",
    state: replaceCard(
      { ...state, error: null },
      opportunityId,
      {
        ...card,
        stage: to,
        generation,
        lock: { kind: "optimistic", from: card.stage, to, generation },
      },
    ),
    opportunityId,
    stage: to,
    lostReason: "",
    confirmationToken: null,
    generation,
  };
}

export function storeConfirmationToken(state: KanbanMoves, opportunityId: string, generation: number, token: string) {
  const card = state.cards.find((item) => item.id === opportunityId);
  if (!card?.lock || card.lock.kind !== "confirm" || card.lock.generation !== generation) {
    return state;
  }
  return replaceCard(state, opportunityId, {
    ...card,
    lock: { ...card.lock, token },
  });
}

export function setLostReason(state: KanbanMoves, opportunityId: string, lostReason: string) {
  const card = state.cards.find((item) => item.id === opportunityId);
  if (!card?.lock || card.lock.kind !== "confirm" || card.lock.to !== "LOST") {
    return state;
  }
  return replaceCard(state, opportunityId, {
    ...card,
    lock: { ...card.lock, lostReason },
  });
}

export function cancelConfirmation(state: KanbanMoves, opportunityId: string) {
  const card = state.cards.find((item) => item.id === opportunityId);
  if (!card?.lock || card.lock.kind !== "confirm") {
    return state;
  }
  return replaceCard(state, opportunityId, { ...card, lock: null });
}

export function acceptMove(state: KanbanMoves, opportunityId: string, generation: number) {
  const card = state.cards.find((item) => item.id === opportunityId);
  if (!card?.lock || card.lock.generation !== generation) {
    return state;
  }
  if (card.lock.kind === "confirm") {
    return replaceCard(state, opportunityId, {
      ...card,
      stage: card.lock.to,
      lock: null,
    });
  }
  return replaceCard(state, opportunityId, { ...card, lock: null });
}

export function rejectMove(state: KanbanMoves, opportunityId: string, generation: number, message: string) {
  const card = state.cards.find((item) => item.id === opportunityId);
  if (!card?.lock || card.lock.generation !== generation) {
    return state;
  }
  const stage = card.lock.kind === "optimistic" ? card.lock.from : card.stage;
  return {
    error: message,
    cards: state.cards.map((item) => (item.id === opportunityId ? { ...item, stage, lock: null } : item)),
  };
}

export function shiftColumnTallies(
  columns: ColumnTally[],
  from: OpportunityStage,
  to: OpportunityStage,
  estimatedValue: string,
) {
  if (from === to) {
    return columns;
  }
  return columns.map((column) => {
    if (column.stage !== from && column.stage !== to) {
      return column;
    }
    const delta = column.stage === to ? 1 : -1;
    const amount =
      column.stage === to
        ? sumMoney([column.estimatedValue, estimatedValue])
        : subtractEstimated(column.estimatedValue, estimatedValue);
    return {
      ...column,
      count: Math.max(0, column.count + delta),
      estimatedValue: amount,
    };
  });
}

function subtractEstimated(total: string, amount: string) {
  try {
    return subtractMoney(total, amount);
  } catch {
    return total;
  }
}

export function openEstimatedValue(columns: ColumnTally[]) {
  return sumMoney(
    columns.filter((column) => isOpenOpportunityStage(column.stage)).map((column) => column.estimatedValue),
  );
}

export function hiddenCardCount(total: number, loaded: number) {
  return Math.max(0, total - loaded);
}

export function cardMatchesQuery(card: { companyName: string; title: string }, query: string) {
  const needle = query.trim().toLocaleLowerCase("fr");
  if (!needle) {
    return true;
  }
  return (
    card.companyName.toLocaleLowerCase("fr").includes(needle) ||
    card.title.toLocaleLowerCase("fr").includes(needle)
  );
}

export function followUpCaption(dueAt: string, now = new Date()) {
  const bucket = dueBucket(new Date(dueAt), now);
  if (bucket === "overdue") {
    return `Relance en retard · ${formatDate(dueAt)}`;
  }
  if (bucket === "today") {
    return "Relance aujourd'hui";
  }
  const dueKey = parisDateKey(dueAt);
  const tomorrow = followUpDueAtAfterCivilDays(1, now);
  if (dueKey === parisDateKey(tomorrow)) {
    return "Relance demain";
  }
  return `Relance · ${formatDate(dueAt)}`;
}

export function kanbanFollowUpDue(preset: KanbanFollowUpPreset, now: Date, customDate: string | null) {
  if (preset === "tomorrow") {
    return followUpDueAtAfterCivilDays(1, now);
  }
  if (preset === "in3Days") {
    return followUpDueAtAfterCivilDays(3, now);
  }
  if (preset === "in1Week") {
    return followUpDueAtAfterCivilDays(7, now);
  }
  return followUpDueAtOnCivilDate(customDate ?? "");
}

export type QuickViewInput = {
  companyName: string;
  lifecycleLabel: string;
  phone: string | null;
  email: string | null;
  instagram: string | null;
  title: string;
  stageLabel: string;
  estimatedValue: string;
  quoteReference: string | null;
  quoteAmount: string | null;
  lastInteraction: string | null;
  nextFollowUp: string | null;
};

export function describeQuickView(input: QuickViewInput) {
  return {
    companyName: input.companyName.trim() || "Entreprise",
    lifecycleLabel: input.lifecycleLabel,
    phone: blankToNull(input.phone),
    email: blankToNull(input.email),
    instagram: blankToNull(input.instagram),
    title: input.title.trim() || "Opportunité",
    stageLabel: input.stageLabel,
    estimatedValue: input.estimatedValue || ZERO_MONEY,
    quoteReference: blankToNull(input.quoteReference),
    quoteAmount: blankToNull(input.quoteAmount),
    lastInteraction: blankToNull(input.lastInteraction),
    nextFollowUp: blankToNull(input.nextFollowUp),
  };
}

function blankToNull(value: string | null) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

export function moneyOrZero(value: string | null | undefined) {
  if (!value || tryParseMoneyToCents(value) === null) {
    return ZERO_MONEY;
  }
  return centsToMoneyString(tryParseMoneyToCents(value) as bigint);
}
