"use server";

import { createInteraction } from "@/actions/interactions";
import type { ActionResult } from "@/lib/crm/action-result";
import { visitFormData } from "@/lib/prospection/visit";

/** Single terrain-visit business function used by the company hub and the daily tour. */
export async function recordTerrainVisit(
  companyId: string,
  occurredAt?: Date,
): Promise<ActionResult> {
  return createInteraction({ ok: false }, visitFormData(companyId, occurredAt));
}

export async function markCompanyVisited(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const companyId = String(formData.get("companyId") ?? "");
  return recordTerrainVisit(companyId);
}
