import "server-only";

import { parisDateKey } from "@/lib/dates";
import type { CreateTaskInput } from "@/ai/schemas/create-task";

function clip(text: string, max = 40): string {
  const trimmed = text.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

/** Operator-facing preview. Dated tasks include civil Europe/Paris + ISO. Keep ≤ 180 chars. */
export function summarizeCreateTask(input: CreateTaskInput): string {
  const scope = input.companyId ? input.companyId : input.projectId ?? "?";
  const title = clip(input.title || "Tâche");
  if (!input.dueAt) {
    return `Tâche « ${title} » — ${scope}.`;
  }
  const civil = parisDateKey(input.dueAt);
  return `Tâche « ${title} » — ${scope} — civil ${civil} — ${input.dueAt}`;
}
