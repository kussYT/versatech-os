"use client";

import { useState, useTransition } from "react";
import { useActionState } from "react";
import { scheduleQuoteReminder, updateQuoteStatus } from "@/actions/quotes";
import { Button } from "@/components/ui/button";
import { idleActionResult } from "@/lib/crm/action-result";
import {
  SENSITIVE_ACTION_CONFIRMS,
  preventUnconfirmedSubmit,
} from "@/lib/crm/confirm-sensitive-action";
import type { QuoteStatus } from "@/generated/prisma/client";

type QuoteFollowUpPreset = "tomorrow" | "in3Days" | "in1Week" | "custom";

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
  projectId?: string | null;
  onCreateProject?: () => void;
};

export function QuoteStatusActions({
  quoteId,
  status,
  projectId = null,
  onCreateProject,
}: QuoteStatusActionsProps) {
  const [state, formAction, pending] = useActionState(updateQuoteStatus, idleActionResult);
  const [followUpMessage, setFollowUpMessage] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [scheduling, startScheduling] = useTransition();
  const actions = ACTIONS.filter((action) => action.from.includes(status));
  const showFollowUp = Boolean(state.ok && state.data?.proposeFollowUp && !dismissed && !followUpMessage);
  const showProject = Boolean(onCreateProject && (state.data?.offerProject || (status === "ACCEPTED" && !projectId)));

  function schedule(preset: QuoteFollowUpPreset) {
    startScheduling(async () => {
      const result = await scheduleQuoteReminder({
        quoteId,
        preset,
        customDueDate: preset === "custom" ? customDate : null,
      });
      setFollowUpMessage(result.ok ? (result.message ?? "Relance programmée") : (result.message ?? "Impossible de programmer la relance."));
    });
  }

  if (actions.length === 0 && !showFollowUp && !showProject && !state.message) {
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
          <Button type="submit" variant={action.variant} className="min-h-12" disabled={pending}>
            {action.label}
          </Button>
        </form>
      ))}
      {state.message ? (
        <p className={`w-full text-meta ${state.ok ? "text-muted" : "text-danger"}`} role={state.ok ? "status" : "alert"}>
          {state.message}
        </p>
      ) : null}
      {showFollowUp ? (
        <div className="w-full space-y-2">
          <p className="text-meta text-muted">Programmer une relance ?</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" className="min-h-12" disabled={scheduling} onClick={() => schedule("tomorrow")}>
              Demain
            </Button>
            <Button type="button" variant="secondary" className="min-h-12" disabled={scheduling} onClick={() => schedule("in3Days")}>
              Dans 3 jours
            </Button>
            <Button type="button" variant="secondary" className="min-h-12" disabled={scheduling} onClick={() => schedule("in1Week")}>
              Dans 1 semaine
            </Button>
            <Button type="button" variant="secondary" className="min-h-12" disabled={scheduling} onClick={() => setDismissed(true)}>
              Pas maintenant
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={customDate}
              onChange={(event) => setCustomDate(event.target.value)}
              className="min-h-12 rounded-xl border border-white/70 bg-white/60 px-3 backdrop-blur-sm focus-visible:border-primary text-body"
            />
            <Button
              type="button"
              variant="secondary"
              className="min-h-12"
              disabled={scheduling || customDate === ""}
              onClick={() => schedule("custom")}
            >
              Cette date
            </Button>
          </div>
        </div>
      ) : null}
      {followUpMessage ? (
        <p className="w-full text-meta text-muted" role="status">
          {followUpMessage}
        </p>
      ) : null}
      {showProject ? (
        <Button type="button" className="min-h-12" onClick={onCreateProject}>
          Créer le projet
        </Button>
      ) : null}
    </div>
  );
}
