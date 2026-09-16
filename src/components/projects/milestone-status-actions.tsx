"use client";

import { useActionState } from "react";
import { updateMilestoneStatus } from "@/actions/milestones";
import { Button } from "@/components/ui/button";
import { idleActionResult } from "@/lib/crm/action-result";
import type { MilestoneStatus } from "@/generated/prisma/client";

const ACTIONS: {
  from: MilestoneStatus[];
  to: MilestoneStatus;
  label: string;
  variant?: "primary" | "secondary" | "danger";
}[] = [
  { from: ["PENDING"], to: "DONE", label: "Marquer terminé" },
  { from: ["PENDING"], to: "CANCELED", label: "Annuler", variant: "danger" },
];

type MilestoneStatusActionsProps = {
  milestoneId: string;
  status: MilestoneStatus;
};

export function MilestoneStatusActions({ milestoneId, status }: MilestoneStatusActionsProps) {
  const [state, formAction, pending] = useActionState(
    updateMilestoneStatus,
    idleActionResult,
  );
  const actions = ACTIONS.filter((action) => action.from.includes(status));

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <form key={action.to} action={formAction}>
          <input type="hidden" name="milestoneId" value={milestoneId} />
          <input type="hidden" name="status" value={action.to} />
          <Button type="submit" size="sm" variant={action.variant} disabled={pending}>
            {action.label}
          </Button>
        </form>
      ))}
      {state.message && !state.ok ? (
        <p className="w-full text-meta text-danger" role="alert">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
