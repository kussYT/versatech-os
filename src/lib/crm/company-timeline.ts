import type {
  CompanyLifecycle,
  InteractionDirection,
  InteractionResult,
  InteractionType,
  OpportunityStage,
} from "@/generated/prisma/client";
import { COMPANY_LIFECYCLE_LABELS, OPPORTUNITY_STAGES } from "@/lib/crm/constants";

export type TimelineInteraction = {
  id: string;
  type: InteractionType;
  direction: InteractionDirection;
  result: InteractionResult | null;
  notes: string | null;
  subject: string | null;
  occurredAt: string;
  followUpDueAt: string | null;
};

export type CompanyTimelineItem =
  | { kind: "interaction"; at: string; interaction: TimelineInteraction }
  | {
      kind: "lifecycle";
      id: string;
      at: string;
      from: CompanyLifecycle;
      to: CompanyLifecycle;
    }
  | {
      kind: "stage";
      id: string;
      at: string;
      opportunityId: string;
      title: string;
      value: string | null;
      fromStage: OpportunityStage;
      toStage: OpportunityStage;
    }
  | {
      kind: "quote";
      id: string;
      at: string;
      reference: string;
      amount: string | null;
      toStatus: "SENT" | "ACCEPTED" | "REJECTED";
    }
  | {
      kind: "followUp";
      id: string;
      at: string;
      title: string;
      dueAt: string;
    };

const LIFECYCLE_SET = new Set<string>(Object.keys(COMPANY_LIFECYCLE_LABELS));
const STAGE_SET = new Set<string>(OPPORTUNITY_STAGES);

function metaString(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

export function buildCompanyTimeline(input: {
  interactions: TimelineInteraction[];
  logs: {
    id: string;
    action: string;
    entityId: string;
    createdAt: string;
    metadata: unknown;
  }[];
  opportunities: { id: string; title: string; estimatedValue: string }[];
  quotes?: { id: string; reference: string; amountIncTax: string }[];
  followUps?: { id: string; title: string; dueAt: string; createdAt: string }[];
}): CompanyTimelineItem[] {
  const titles = new Map(input.opportunities.map((opportunity) => [opportunity.id, opportunity]));
  const quotes = new Map((input.quotes ?? []).map((quote) => [quote.id, quote]));
  const items: CompanyTimelineItem[] = input.interactions.map((interaction) => ({
    kind: "interaction",
    at: interaction.occurredAt,
    interaction,
  }));

  for (const log of input.logs) {
    if (log.action === "company.lifecycle_changed") {
      const from = metaString(log.metadata, "from");
      const to = metaString(log.metadata, "to");
      if (!from || !to || !LIFECYCLE_SET.has(from) || !LIFECYCLE_SET.has(to)) {
        continue;
      }
      items.push({
        kind: "lifecycle",
        id: log.id,
        at: log.createdAt,
        from: from as CompanyLifecycle,
        to: to as CompanyLifecycle,
      });
      continue;
    }

    if (log.action === "quote.status_changed") {
      const toStatus = metaString(log.metadata, "toStatus");
      if (toStatus !== "SENT" && toStatus !== "ACCEPTED" && toStatus !== "REJECTED") {
        continue;
      }
      const quote = quotes.get(log.entityId);
      items.push({
        kind: "quote",
        id: log.id,
        at: log.createdAt,
        reference: metaString(log.metadata, "reference") ?? quote?.reference ?? "Devis",
        amount: metaString(log.metadata, "amountIncTax") ?? quote?.amountIncTax ?? null,
        toStatus,
      });
      continue;
    }

    if (log.action !== "opportunity.stage_changed") {
      continue;
    }

    const fromStage = metaString(log.metadata, "fromStage");
    const toStage = metaString(log.metadata, "toStage");
    if (!fromStage || !toStage || !STAGE_SET.has(fromStage) || !STAGE_SET.has(toStage)) {
      continue;
    }
    const opportunity = titles.get(log.entityId);
    items.push({
      kind: "stage",
      id: log.id,
      at: log.createdAt,
      opportunityId: log.entityId,
      title: opportunity?.title ?? "Opportunité",
      value: opportunity?.estimatedValue ?? null,
      fromStage: fromStage as OpportunityStage,
      toStage: toStage as OpportunityStage,
    });
  }

  for (const followUp of input.followUps ?? []) {
    items.push({
      kind: "followUp",
      id: followUp.id,
      at: followUp.createdAt,
      title: followUp.title,
      dueAt: followUp.dueAt,
    });
  }

  return items.sort((left, right) => right.at.localeCompare(left.at));
}
