import "server-only";

import type { CompleteFollowUpInput } from "@/ai/schemas/complete-follow-up";

/** Operator-facing preview. Completing a follow-up has no due date. */
export function summarizeCompleteFollowUp(input: CompleteFollowUpInput): string {
  return `Terminer la relance ${input.followUpId}.`;
}
