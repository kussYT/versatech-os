"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { setJourneyStep } from "@/actions/journey";
import { JourneyStepControl } from "@/components/crm/journey-step-control";
import { Card } from "@/components/ui/card";
import { idleActionResult } from "@/lib/crm/action-result";
import { SENSITIVE_ACTION_CONFIRMS } from "@/lib/crm/confirm-sensitive-action";
import { formatDate } from "@/lib/crm/form-data";
import {
  assessDeclaredStepChange,
  DECLARED_JOURNEY_STEP_LABELS,
  defaultJourneyContextKey,
  listJourneyContexts,
  visibleJourneyCursor,
  type DeclaredJourneyStep,
  type JourneyBoard,
} from "@/lib/crm/journey-cursor";
import type { ClientJourney, ClientJourneyStep, JourneyStepStatus } from "@/lib/client-journey";
import { cn } from "@/lib/cn";

type ClientJourneySectionProps = {
  journey: ClientJourney;
  journeyViews: Record<string, ClientJourney>;
  companyId: string;
  opportunities: Array<{ id: string; title: string }>;
  projects: Array<{ id: string; name: string; opportunityId: string | null }>;
  board: JourneyBoard;
  principalPrestation?: { projectId: string | null; opportunityId: string | null } | null;
};

const STEP_TONE: Record<JourneyStepStatus, string> = {
  COMPLETED: "border-emerald-300/80 bg-emerald-50 text-emerald-700",
  CURRENT: "border-primary/40 bg-primary/10 text-primary shadow-[0_1px_4px_rgb(0_102_214/0.12)]",
  MISSING: "border-amber-300/80 bg-amber-50 text-amber-700",
  UPCOMING: "border-white/70 bg-white/50 text-faint",
};

function principalLabel(journey: ClientJourney) {
  const parts = [
    journey.principal.project?.name,
    journey.principal.quote?.reference,
    journey.principal.opportunity?.title,
  ].filter(Boolean);
  if (parts.length === 0) {
    return journey.principal.reason;
  }
  return `${journey.principal.reason} · ${parts.join(" · ")}`;
}

function connectorClass(complete: boolean) {
  return complete ? "bg-success/45" : "bg-border";
}

function stepCaption(step: ClientJourneyStep) {
  if (step.date) {
    return formatDate(step.date);
  }
  if (step.status === "CURRENT") {
    return "En attente";
  }
  return null;
}

function furthestCompletedStep(steps: ClientJourneyStep[]): DeclaredJourneyStep | null {
  let furthest: DeclaredJourneyStep | null = null;
  for (const step of steps) {
    if (step.status === "COMPLETED") {
      furthest = step.key;
    }
  }
  return furthest;
}

export function ClientJourneySection({
  journey,
  journeyViews,
  companyId,
  opportunities,
  projects,
  board,
  principalPrestation = null,
}: ClientJourneySectionProps) {
  const contexts = listJourneyContexts(companyId, { opportunities, projects });
  const [contextKey, setContextKey] = useState(() =>
    defaultJourneyContextKey(contexts, {
      projectId: principalPrestation?.projectId ?? journey.principal.project?.id ?? null,
      opportunityId: principalPrestation?.opportunityId ?? journey.principal.opportunity?.id ?? null,
    }),
  );
  const selected = contexts.find((item) => item.contextKey === contextKey) ?? contexts[0];
  const cursor = selected ? visibleJourneyCursor(board.cursors, selected) : null;
  const shown = journeyViews[contextKey] ?? journey;
  const lastIndex = shown.steps.length - 1;
  const factsFurthest = furthestCompletedStep(shown.steps);
  const factsCurrent = shown.steps.find((step) => step.status === "CURRENT")?.key ?? null;

  const [setState, setAction, setPending] = useActionState(setJourneyStep, idleActionResult);
  const formRef = useRef<HTMLFormElement>(null);
  const stepInputRef = useRef<HTMLInputElement>(null);

  function declareStep(target: DeclaredJourneyStep) {
    if (!selected || !board.schemaReady || setPending || !formRef.current || !stepInputRef.current) {
      return;
    }
    const assessment = assessDeclaredStepChange({
      target,
      currentDeclared: cursor?.step ?? null,
      factsFurthestCompleted: factsFurthest,
    });
    if (assessment.unchanged) {
      return;
    }
    if (assessment.inconsistent) {
      const factsAfter = assessment.completedFactsAfter
        .map((step) => DECLARED_JOURNEY_STEP_LABELS[step])
        .join(", ");
      const ok = window.confirm(
        `${SENSITIVE_ACTION_CONFIRMS.journeyStepBackward}\n\nFaits plus avancés : ${factsAfter || "oui"}.`,
      );
      if (!ok) {
        return;
      }
    }
    stepInputRef.current.value = target;
    formRef.current.requestSubmit();
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-section text-foreground">Parcours client</h2>
          <p className="mt-1 text-meta text-muted">{principalLabel(shown)}</p>
          <p className="mt-1 text-meta text-muted">
            Pastilles = faits. Cliquez une étape pour déclarer la position manuelle (dans les deux
            sens).
          </p>
        </div>
        {shown.complete ? (
          <span className="rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-badge font-semibold tracking-wide text-success uppercase">
            Complet
          </span>
        ) : null}
      </div>

      {selected && board.schemaReady ? (
        <form ref={formRef} action={setAction} className="hidden" aria-hidden="true">
          <input type="hidden" name="companyId" value={selected.companyId} />
          <input type="hidden" name="opportunityId" value={selected.opportunityId ?? ""} />
          <input type="hidden" name="projectId" value={selected.projectId ?? ""} />
          <input
            ref={stepInputRef}
            type="hidden"
            name="step"
            defaultValue={cursor?.step ?? "CONTACT"}
          />
        </form>
      ) : null}

      <ol className="mt-5 md:flex md:items-start">
        {shown.steps.map((step, index) => {
          const next = shown.steps[index + 1];
          const lineComplete =
            step.status === "COMPLETED" &&
            (next?.status === "COMPLETED" || next?.status === "CURRENT");
          const isDeclared = cursor?.step === step.key;
          const caption = stepCaption(step);

          return (
            <li
              key={step.key}
              className="relative flex gap-3 md:min-w-0 md:flex-1 md:flex-col md:items-stretch md:gap-0"
              aria-current={isDeclared ? "step" : step.status === "CURRENT" ? "step" : undefined}
            >
              {index < lastIndex ? (
                <span
                  className={cn(
                    "absolute top-8 left-[0.95rem] h-[calc(100%-2rem)] w-px md:hidden",
                    connectorClass(lineComplete),
                  )}
                  aria-hidden="true"
                />
              ) : null}

              <div className="flex items-center md:px-0">
                {index > 0 ? (
                  <span
                    className={cn(
                      "hidden h-px flex-1 md:block",
                      connectorClass(
                        shown.steps[index - 1]?.status === "COMPLETED" &&
                          (step.status === "COMPLETED" || step.status === "CURRENT"),
                      ),
                    )}
                    aria-hidden="true"
                  />
                ) : (
                  <span className="hidden flex-1 md:block" aria-hidden="true" />
                )}
                <button
                  type="button"
                  disabled={!board.schemaReady || setPending}
                  onClick={() => declareStep(step.key)}
                  title={`Déclarer l'étape ${step.label}`}
                  className={cn(
                    "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border text-badge font-semibold transition-transform duration-hover hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50",
                    STEP_TONE[step.status],
                    isDeclared && "ring-2 ring-primary ring-offset-2 ring-offset-transparent",
                    step.status === "CURRENT" &&
                      !isDeclared &&
                      "after:pointer-events-none after:absolute after:inset-[-5px] after:rounded-full after:border after:border-primary/20 after:content-['']",
                  )}
                >
                  <span className="sr-only">
                    Déclarer {step.label}
                    {isDeclared ? " (étape déclarée)" : ""}
                    {step.status === "COMPLETED" ? " — fait attesté" : ""}
                  </span>
                  {step.status === "COMPLETED" ? (
                    <Check className="size-3.5" strokeWidth={2.4} aria-hidden="true" />
                  ) : (
                    <span aria-hidden="true">{index + 1}</span>
                  )}
                </button>
                {index < lastIndex ? (
                  <span
                    className={cn("hidden h-px flex-1 md:block", connectorClass(lineComplete))}
                    aria-hidden="true"
                  />
                ) : (
                  <span className="hidden flex-1 md:block" aria-hidden="true" />
                )}
              </div>

              <div className="min-w-0 flex-1 pb-5 md:mt-3 md:px-1 md:pb-0 md:text-center">
                <button
                  type="button"
                  disabled={!board.schemaReady || setPending}
                  onClick={() => declareStep(step.key)}
                  className="w-full rounded-md text-left md:text-center disabled:opacity-50"
                >
                  <p
                    className={cn(
                      "text-meta font-medium",
                      step.status === "UPCOMING" && !isDeclared ? "text-faint" : "text-foreground",
                      isDeclared && "text-primary",
                    )}
                  >
                    {step.label}
                    {isDeclared ? (
                      <span className="ml-1 text-[0.65rem] font-semibold tracking-wide uppercase">
                        déclaré
                      </span>
                    ) : null}
                  </p>
                  {caption ? (
                    <p className="mt-0.5 font-mono text-[0.7rem] text-muted">{caption}</p>
                  ) : null}
                </button>
                {step.context ? (
                  <p className="mt-1 line-clamp-2 text-[0.7rem] text-muted">{step.context}</p>
                ) : null}
                {step.link ? (
                  <Link
                    href={step.link}
                    className="mt-1 inline-block text-[0.7rem] text-primary hover:text-primary-hover"
                  >
                    Voir le détail
                  </Link>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {setState.message ? (
        <p
          className={`mt-3 text-meta ${setState.ok ? "text-muted" : "text-danger"}`}
          role={setState.ok ? "status" : "alert"}
        >
          {setState.message}
        </p>
      ) : null}

      <JourneyStepControl
        companyId={companyId}
        opportunities={opportunities}
        projects={projects}
        contextKey={contextKey}
        onContextKeyChange={setContextKey}
        factsStep={factsCurrent}
        board={board}
      />
    </Card>
  );
}
