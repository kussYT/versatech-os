"use client";

import { useActionState } from "react";
import { updatePaymentStatus } from "@/actions/payments";
import { Button } from "@/components/ui/button";
import { idleActionResult } from "@/lib/crm/action-result";
import {
  SENSITIVE_ACTION_CONFIRMS,
  preventUnconfirmedSubmit,
} from "@/lib/crm/confirm-sensitive-action";
import type { PaymentStatus } from "@/generated/prisma/client";

const ACTIONS: {
  from: PaymentStatus[];
  to: PaymentStatus;
  label: string;
  variant?: "primary" | "secondary" | "danger";
  confirm?: string;
}[] = [
  {
    from: ["PENDING", "OVERDUE"],
    to: "PAID",
    label: "Marquer payé",
    confirm: SENSITIVE_ACTION_CONFIRMS.paymentPaid,
  },
  { from: ["PENDING"], to: "OVERDUE", label: "Marquer en retard", variant: "secondary" },
  {
    from: ["PENDING", "OVERDUE"],
    to: "CANCELED",
    label: "Annuler",
    variant: "danger",
    confirm: SENSITIVE_ACTION_CONFIRMS.paymentCanceled,
  },
];

type PaymentStatusActionsProps = {
  paymentId: string;
  status: PaymentStatus;
};

export function PaymentStatusActions({ paymentId, status }: PaymentStatusActionsProps) {
  const [state, formAction, pending] = useActionState(
    updatePaymentStatus,
    idleActionResult,
  );
  const actions = ACTIONS.filter((action) => action.from.includes(status));

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <form
          key={action.to}
          action={formAction}
          onSubmit={action.confirm ? preventUnconfirmedSubmit(action.confirm) : undefined}
        >
          <input type="hidden" name="paymentId" value={paymentId} />
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
