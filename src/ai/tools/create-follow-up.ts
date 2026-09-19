import "server-only";

import { parisDateKey } from "@/lib/dates";
import type { CreateFollowUpInput } from "@/ai/schemas/create-follow-up";

function clip(text: string, max = 40): string {
  const trimmed = text.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

/** Operator-facing preview. Includes civil Europe/Paris date and ISO. Keep ≤ 180 chars. */
export function summarizeCreateFollowUp(input: CreateFollowUpInput): string {
  const title = clip(input.title || "Relance");
  const companyId = input.companyId || "?";
  if (!input.dueAt) {
    return `Relance « ${title} » — ${companyId}.`;
  }
  const civil = parisDateKey(input.dueAt);
  return `Relance « ${title} » — ${companyId} — civil ${civil} — ${input.dueAt}`;
}
