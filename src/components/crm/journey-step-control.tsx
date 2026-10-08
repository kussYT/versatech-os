"use client";

import { useActionState } from "react";
import { resetJourneyStep, setJourneyStep } from "@/actions/journey";
import { Button } from "@/components/ui/button";
import { idleActionResult } from "@/lib/crm/action-result";
import { formatDateTime } from "@/lib/crm/form-data";
import {
  DECLARED_JOURNEY_STEP_LABELS,
  DECLARED_JOURNEY_STEPS,
  eventsForJourneyContext,
  listJourneyContexts,
  visibleJourneyCursor,
  type DeclaredJourneyStep,
} from "@/lib/crm/journey-cursor";
import type { JourneyBoard } from "@/lib/crm/journey-cursor";

type JourneyStepControlProps = {
  companyId: string;
  opportunities: Array<{ id: string; title: string }>;
  projects: Array<{ id: string; name: string; opportunityId: string | null }>;
  contextKey: string;
  onContextKeyChange: (contextKey: string) => void;
  factsStep: DeclaredJourneyStep | null;
  board: JourneyBoard;
};

export function JourneyStepControl({
  companyId,
  opportunities,
  projects,
  contextKey,
  onContextKeyChange,
  factsStep,
  board,
}: JourneyStepControlProps) {
  const contexts = listJourneyContexts(companyId, { opportunities, projects });
  const [setState, setAction, setPending] = useActionState(setJourneyStep, idleActionResult);
  const [resetState, resetAction, resetPending] = useActionState(resetJourneyStep, idleActionResult);
  const selected = contexts.find((item) => item.contextKey === contextKey) ?? contexts[0];
  const cursor = selected ? visibleJourneyCursor(board.cursors, selected) : null;
  const events = selected ? eventsForJourneyContext(board.events, selected).slice(0, 5) : [];
  const factsLabel = factsStep ? DECLARED_JOURNEY_STEP_LABELS[factsStep] : "aucune étape en cours";
  const pending = setPending || resetPending;
  const notice = setState.message ?? resetState.message;

  if (!selected) {
    return null;
  }

  if (!board.schemaReady) {
    return (
      <p className="mt-4 text-meta text-muted">
        L&apos;étape déclarée sera disponible après la migration du curseur de parcours. Les pastilles suivent déjà les faits.
      </p>
    );
  }

  return (
    <div className="mt-5 border-t border-border pt-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-body text-foreground">
            {cursor
              ? `Étape déclarée : ${DECLARED_JOURNEY_STEP_LABELS[cursor.step]}`
              : "Étape déclarée : aucune, calcul automatique"}
          </p>
          <p className="mt-1 text-meta text-muted">Selon les faits : {factsLabel}. Un changement d&apos;étape ne modifie ni devis, ni paiement, ni projet.</p>
        </div>
        {contexts.length > 1 ? (
          <label className="block min-w-0 text-meta text-muted sm:max-w-xs">
            Prestation
            <select
              className="mt-1 min-h-12 w-full rounded-xl border border-border bg-background px-3 text-body text-foreground"
              value={selected.contextKey}
              onChange={(event) => onContextKeyChange(event.target.value)}
            >
              {contexts.map((item) => (
                <option key={item.contextKey} value={item.contextKey}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <form action={setAction} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <input type="hidden" name="companyId" value={selected.companyId} />
        <input type="hidden" name="opportunityId" value={selected.opportunityId ?? ""} />
        <input type="hidden" name="projectId" value={selected.projectId ?? ""} />
        <label className="block min-w-0 flex-1 text-meta text-muted">
          Modifier l&apos;étape
          <select
            name="step"
            key={`${selected.contextKey}-${cursor?.step ?? "auto"}`}
            defaultValue={cursor?.step ?? factsStep ?? "CONTACT"}
            className="mt-1 min-h-12 w-full rounded-xl border border-border bg-background px-3 text-body text-foreground"
          >
            {DECLARED_JOURNEY_STEPS.map((step) => (
              <option key={step} value={step}>
                {DECLARED_JOURNEY_STEP_LABELS[step]}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" className="min-h-12" disabled={pending}>
          Enregistrer
        </Button>
      </form>

      {cursor ? (
        <form action={resetAction} className="mt-2">
          <input type="hidden" name="companyId" value={selected.companyId} />
          <input type="hidden" name="opportunityId" value={selected.opportunityId ?? ""} />
          <input type="hidden" name="projectId" value={selected.projectId ?? ""} />
          <Button type="submit" variant="secondary" className="min-h-12" disabled={pending}>
            Revenir au calcul automatique
          </Button>
        </form>
      ) : null}

      {notice ? (
        <p className="mt-3 text-meta text-muted" role="status">
          {notice}
        </p>
      ) : null}

      {events.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-1">
          {events.map((event) => (
            <li key={event.id} className="text-meta text-muted">
              {formatDateTime(event.changedAt)}
              {" · "}
              {event.action === "reset"
                ? `Retour au calcul automatique${event.fromStep ? ` depuis ${DECLARED_JOURNEY_STEP_LABELS[event.fromStep]}` : ""}`
                : event.action === "adopt"
                  ? `Repris sur le projet${event.toStep ? ` · ${DECLARED_JOURNEY_STEP_LABELS[event.toStep]}` : ""}`
                  : `${event.fromStep ? DECLARED_JOURNEY_STEP_LABELS[event.fromStep] : "Calcul automatique"} → ${event.toStep ? DECLARED_JOURNEY_STEP_LABELS[event.toStep] : ""}`}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
