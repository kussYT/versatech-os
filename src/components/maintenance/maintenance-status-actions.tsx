"use client";

import { useActionState } from "react";
import { updateMaintenanceStatus } from "@/actions/maintenance";
import { Button } from "@/components/ui/button";
import { idleActionResult } from "@/lib/crm/action-result";
import type { MaintenanceStatus } from "@/generated/prisma/client";

const ACTIONS: {
  from: MaintenanceStatus[];
  to: MaintenanceStatus;
  label: string;
  variant?: "primary" | "secondary" | "danger";
}[] = [
  { from: ["PAUSED"], to: "ACTIVE", label: "Activer" },
  { from: ["ACTIVE"], to: "PAUSED", label: "Suspendre", variant: "secondary" },
  { from: ["ACTIVE", "PAUSED"], to: "ENDED", label: "Terminer", variant: "danger" },
];

type MaintenanceStatusActionsProps = {
  contractId: string;
  status: MaintenanceStatus;
};

export function MaintenanceStatusActions({ contractId, status }: MaintenanceStatusActionsProps) {
  const [state, formAction, pending] = useActionState(updateMaintenanceStatus, idleActionResult);
  const actions = ACTIONS.filter((action) => action.from.includes(status));

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <form key={action.to} action={formAction}>
          <input type="hidden" name="contractId" value={contractId} />
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
