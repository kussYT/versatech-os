import "server-only";

import type { SessionUser } from "@/lib/auth/types";
import {
  loadPipelineOverview,
  loadPipelineStageCards,
  loadPipelineValueRows,
} from "@/lib/queries/opportunities";
import { mapPipeline } from "./map";
import {
  OPEN_OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGES,
  parseGetPipelineInput,
  requireServiceActor,
  type OpportunityStage,
  type PipelineDto,
} from "./schema";

export type GetPipelineInput = {
  actor: SessionUser;
  openOnly?: boolean;
  limitPerStage?: number;
};

/**
 * Pipeline commercial : counts tous stages, cartes bornées, money.ts (BR-017).
 * Pas du CA signé. READ only — no redirect, no ActivityLog.
 */
export async function getPipeline({
  actor,
  openOnly,
  limitPerStage,
}: GetPipelineInput): Promise<PipelineDto> {
  requireServiceActor(actor);
  const input = parseGetPipelineInput({ openOnly, limitPerStage });
  const stages: readonly OpportunityStage[] = input.openOnly
    ? OPEN_OPPORTUNITY_STAGES
    : OPPORTUNITY_STAGES;

  const [overview, valueRows, ...cardGroups] = await Promise.all([
    loadPipelineOverview(),
    loadPipelineValueRows(),
    ...stages.map((stage) => loadPipelineStageCards(stage, input.limitPerStage)),
  ]);

  const cardsByStage = new Map<OpportunityStage, (typeof cardGroups)[number]>();
  stages.forEach((stage, index) => {
    cardsByStage.set(stage, cardGroups[index] ?? []);
  });

  return mapPipeline({
    overview,
    valueRows,
    cardsByStage,
    openOnly: input.openOnly,
    limitPerStage: input.limitPerStage,
  });
}

export const OpportunityService = {
  getPipeline,
};
