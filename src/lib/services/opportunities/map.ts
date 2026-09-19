import "server-only";

import { centsToMoneyString, tryParseMoneyToCents, weightedMoney } from "@/lib/money";
import type {
  PipelineOpportunityCard,
  PipelineOverviewLoad,
  PipelineValueRow,
} from "@/lib/queries/opportunities";
import {
  clampCollection,
  OPEN_OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGES,
  parsePipeline,
  pipelineCountsSchema,
  type OpportunityStage,
  type PipelineCardDto,
  type PipelineDto,
  type PipelineStageDto,
} from "./schema";

function toCanonicalMoney(value: string): string {
  const cents = tryParseMoneyToCents(value);
  if (cents === null) {
    throw new Error("Montant invalide.");
  }
  return centsToMoneyString(cents);
}

export function mapPipelineCard(card: PipelineOpportunityCard): PipelineCardDto {
  const estimatedValue = toCanonicalMoney(card.estimatedValue);
  return {
    id: card.id,
    title: card.title,
    stage: card.stage,
    estimatedValue,
    probability: card.probability,
    weightedValue: weightedMoney(estimatedValue, card.probability),
    company: {
      id: card.company.id,
      name: card.company.name,
      city: card.company.city,
    },
    nextFollowUp: card.nextFollowUp,
    lastInteraction: card.lastInteraction,
  };
}

export function moneyTotalsForStage(rows: readonly PipelineValueRow[], stage: OpportunityStage) {
  let brutCents = BigInt(0);
  let weightedCents = BigInt(0);

  for (const row of rows) {
    if (row.stage !== stage) {
      continue;
    }
    const cents = tryParseMoneyToCents(row.estimatedValue);
    if (cents === null) {
      continue;
    }
    brutCents += cents;
    try {
      const weighted = tryParseMoneyToCents(weightedMoney(row.estimatedValue, row.probability));
      if (weighted !== null) {
        weightedCents += weighted;
      }
    } catch {
      continue;
    }
  }

  return {
    estimatedTotal: centsToMoneyString(brutCents),
    weightedTotal: centsToMoneyString(weightedCents),
  };
}

export function mapPipeline(input: {
  overview: PipelineOverviewLoad;
  valueRows: readonly PipelineValueRow[];
  cardsByStage: ReadonlyMap<OpportunityStage, PipelineOpportunityCard[]>;
  openOnly: boolean;
  limitPerStage: number;
}): PipelineDto {
  const stages = (input.openOnly ? OPEN_OPPORTUNITY_STAGES : OPPORTUNITY_STAGES).map(
    (stage): PipelineStageDto => {
      const totals = moneyTotalsForStage(input.valueRows, stage);
      const cards = clampCollection(input.cardsByStage.get(stage) ?? [], input.limitPerStage).map(
        mapPipelineCard,
      );
      return {
        stage,
        count: input.overview.counts[stage],
        estimatedTotal: totals.estimatedTotal,
        weightedTotal: totals.weightedTotal,
        opportunities: cards,
      };
    },
  );

  return parsePipeline({
    openCount: input.overview.openCount,
    brutTotal: input.overview.brutTotalMoney,
    weightedTotal: input.overview.weightedTotalMoney,
    counts: pipelineCountsSchema.parse(input.overview.counts),
    stages,
  });
}
