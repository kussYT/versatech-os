import { COMPANY_LIFECYCLE_LABELS } from "@/lib/crm/constants";
import type { CompanyLifecycle } from "@/generated/prisma/client";

export const PROSPECT_DUPLICATE_LIMIT = 5;
export const PROSPECT_DUPLICATE_MIN_LENGTH = 2;

export type ProspectDuplicateHit = {
  id: string;
  name: string;
  city: string | null;
  lifecycleStatus: CompanyLifecycle;
};

/** Libellé secondaire pour une suggestion anti-doublon (ex. « Lead — Raismes »). */
export function formatProspectDuplicateSubtitle(hit: ProspectDuplicateHit): string {
  const lifecycle = COMPANY_LIFECYCLE_LABELS[hit.lifecycleStatus] ?? hit.lifecycleStatus;
  const city = hit.city?.trim();
  if (city) {
    return `${lifecycle} — ${city}`;
  }
  return lifecycle;
}

export function prospectDuplicateLabel(hit: ProspectDuplicateHit): string {
  const subtitle = formatProspectDuplicateSubtitle(hit);
  return `${hit.name} — ${subtitle}`;
}
