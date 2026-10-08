"use server";

import type { OpportunityStage } from "@/generated/prisma/client";
import { OPPORTUNITY_STAGES } from "@/lib/crm/constants";
import { loadKanbanColumnPage, loadOpportunityQuickView } from "@/lib/queries/opportunities";

function isStage(value: string): value is OpportunityStage {
  return (OPPORTUNITY_STAGES as readonly string[]).includes(value);
}

export async function fetchKanbanPage(stage: string, skip: number) {
  if (!isStage(stage) || !Number.isInteger(skip) || skip < 0) {
    return [];
  }
  return loadKanbanColumnPage(stage, skip);
}

export async function fetchOpportunityQuickView(opportunityId: string) {
  if (!opportunityId.trim()) {
    return null;
  }
  return loadOpportunityQuickView(opportunityId);
}
