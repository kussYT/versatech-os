"use client";

import { useActionState } from "react";
import { updateQuoteStatus } from "@/actions/quotes";
import { Button } from "@/components/ui/button";
import { idleActionResult } from "@/lib/crm/action-result";
import {
  SENSITIVE_ACTION_CONFIRMS,
  preventUnconfirmedSubmit,
} from "@/lib/crm/confirm-sensitive-action";
import type { QuoteStatus } from "@/generated/prisma/client";

const ACTIONS: {
  from: QuoteStatus[];
  to: QuoteStatus;
  label: string;
  variant?: "primary" | "secondary" | "danger";
  confirm?: string;
}[] = [
  { from: ["DRAFT"], to: "SENT", label: "Marquer envoyé" },
  { from: ["SENT"], to: "VIEWED", label: "Marquer consulté", variant: "secondary" },
  {
    from: ["SENT", "VIEWED"],
    to: "ACCEPTED",
    label: "Accepter",
    confirm: SENSITIVE_ACTION_CONFIRMS.quoteAccepted,
  },
  {
    from: ["SENT", "VIEWED"],
    to: "REJECTED",
    label: "Refuser",
    variant: "danger",
    confirm: SENSITIVE_ACTION_CONFIRMS.quoteRejected,
  },
];

type QuoteStatusActionsProps = {
  quoteId: string;
  status: QuoteStatus;
};

export function QuoteStatusActions({ quoteId, status }: QuoteStatusActionsProps) {
  const [state, formAction, pending] = useActionState(
    updateQuoteStatus,
    idleActionResult,
  );
  const actions = ACTIONS.filter((action) => action.from.includes(status));

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 scroll-mb-28">
      {actions.map((action) => (
        <form
          key={action.to}
          action={formAction}
          onSubmit={action.confirm ? preventUnconfirmedSubmit(action.confirm) : undefined}
        >
          <input type="hidden" name="quoteId" value={quoteId} />
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
