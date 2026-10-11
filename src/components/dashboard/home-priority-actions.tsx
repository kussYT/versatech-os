"use client";

import { useActionState } from "react";
import Link from "next/link";
import { completeFollowUp } from "@/actions/follow-ups";
import { idleActionResult } from "@/lib/crm/action-result";
import type { WorkAction } from "@/lib/dashboard/operations";
import { cn } from "@/lib/cn";

type HomePriorityActionsProps = {
  actions: WorkAction[];
};

function urgencyPill(urgency: WorkAction["urgency"], whenLabel: string) {
  if (urgency === "overdue" || whenLabel.toLowerCase().includes("retard")) {
    return "bg-danger/12 text-danger";
  }
  if (urgency === "today" || whenLabel.toLowerCase() === "aujourd'hui") {
    return "bg-danger/12 text-danger";
  }
  if (whenLabel.toLowerCase() === "demain") {
    return "bg-warning/15 text-warning";
  }
  return "bg-primary/10 text-primary";
}

export function HomePriorityActions({ actions }: HomePriorityActionsProps) {
  return (
    <section className="glass-card flex h-full flex-col p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-section text-foreground">Actions prioritaires</h2>
        <Link href="/relances" className="text-meta font-medium text-primary hover:text-primary-hover">
          Voir tout →
        </Link>
      </div>

      {actions.length === 0 ? (
        <div className="mt-6 flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-white/40 px-3 py-8 text-center">
          <p className="text-body font-medium text-foreground">Aucune action prioritaire</p>
          <p className="mt-1 text-meta text-muted">Les relances et devis à traiter apparaîtront ici.</p>
        </div>
      ) : (
        <ul className="mt-4 flex-1 space-y-2">
          {actions.map((action) => (
            <li
              key={action.id}
              className="flex items-start gap-3 rounded-2xl px-1.5 py-2 transition-colors duration-hover hover:bg-white/55"
            >
              {action.followUpId ? (
                <CompleteFollowUpCheck followUpId={action.followUpId} />
              ) : (
                <span
                  className="mt-0.5 size-5 shrink-0 rounded-full border border-border bg-white/70"
                  aria-hidden="true"
                />
              )}
              <div className="min-w-0 flex-1">
                <Link
                  href={`/entreprises/${action.companyId}`}
                  className="text-body font-medium text-foreground hover:text-primary"
                >
                  {action.title}
                </Link>
                <p className="mt-0.5 truncate text-meta text-muted">{action.companyName}</p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-badge font-semibold tracking-normal normal-case",
                  urgencyPill(action.urgency, action.whenLabel),
                )}
              >
                {action.whenLabel}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CompleteFollowUpCheck({ followUpId }: { followUpId: string }) {
  const [state, formAction, pending] = useActionState(completeFollowUp, idleActionResult);

  return (
    <form action={formAction}>
      <input type="hidden" name="followUpId" value={followUpId} />
      <button
        type="submit"
        disabled={pending || state.ok}
        aria-label={state.ok ? "Relance terminée" : "Marquer la relance comme faite"}
        className={cn(
          "mt-0.5 flex size-5 items-center justify-center rounded-full border transition-colors duration-hover",
          state.ok
            ? "border-success bg-success text-white"
            : "border-border bg-white/80 text-transparent hover:border-primary hover:text-primary",
        )}
      >
        <span aria-hidden="true" className="text-[10px] font-bold">
          ✓
        </span>
      </button>
    </form>
  );
}
