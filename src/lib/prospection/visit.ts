import { toDateTimeLocalValue } from "@/lib/dates";

/**
 * Terrain visit is a real CRM Interaction, not a UI flag.
 * Type stays MEETING so a LEAD can become CONTACTED, but Analytics RDV
 * KPIs must exclude these via {@link isTerrainVisit}.
 */
export const VISIT_INTERACTION_TYPE = "MEETING" as const;
export const VISIT_INTERACTION_DIRECTION = "INTERNAL" as const;
export const VISIT_INTERACTION_RESULT = "OTHER" as const;
export const VISIT_NOTES = "Visite terrain";

export function buildVisitInteractionFields(companyId: string, occurredAt = new Date()) {
  return {
    companyId,
    type: VISIT_INTERACTION_TYPE,
    direction: VISIT_INTERACTION_DIRECTION,
    result: VISIT_INTERACTION_RESULT,
    occurredAt: toDateTimeLocalValue(occurredAt),
    notes: VISIT_NOTES,
  };
}

export function visitFormData(companyId: string, occurredAt = new Date()) {
  const fields = buildVisitInteractionFields(companyId, occurredAt);
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

export function isTerrainVisit(interaction: {
  type: string;
  direction?: string | null;
  result?: string | null;
  notes?: string | null;
  subject?: string | null;
}) {
  if (interaction.type !== VISIT_INTERACTION_TYPE) {
    return false;
  }

  const notes = interaction.notes?.trim() ?? "";
  const subject = interaction.subject?.trim() ?? "";
  const labeled = notes === VISIT_NOTES || subject === VISIT_NOTES;
  if (!labeled) {
    return false;
  }

  if (interaction.direction && interaction.direction !== VISIT_INTERACTION_DIRECTION) {
    return false;
  }

  if (interaction.result && interaction.result !== VISIT_INTERACTION_RESULT) {
    return false;
  }

  return true;
}
