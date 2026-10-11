"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/crm/form-data";
import { cn } from "@/lib/cn";
import { JourneyStepControl } from "@/components/crm/journey-step-control";
import type { ClientJourney, ClientJourneyStep, JourneyStepStatus } from "@/lib/client-journey";
import {
  defaultJourneyContextKey,
  listJourneyContexts,
  type JourneyBoard,
} from "@/lib/crm/journey-cursor";

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

function StepMarker({ step, index }: { step: ClientJourneyStep; index: number }) {
  return (
    <span
      className={cn(
        "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border text-badge font-semibold",
        STEP_TONE[step.status],
        step.status === "CURRENT" &&
          "after:pointer-events-none after:absolute after:inset-[-5px] after:rounded-full after:border after:border-primary/20 after:content-['']",
      )}
      aria-hidden="true"
    >
      {step.status === "COMPLETED" ? <Check className="size-3.5" strokeWidth={2.4} /> : index + 1}
    </span>
  );
}

function StepBody({ step }: { step: ClientJourneyStep }) {
  const caption = stepCaption(step);
  const inner = (
    <>
      <p
        className={cn(
          "text-meta font-medium",
          step.status === "UPCOMING" ? "text-faint" : "text-foreground",
        )}
      >
        {step.label}
      </p>
      {caption ? <p className="mt-0.5 font-mono text-[0.7rem] text-muted">{caption}</p> : null}
      {step.context ? (
        <p className="mt-1 line-clamp-2 text-[0.7rem] text-muted">{step.context}</p>
      ) : null}
    </>
  );

  if (!step.link) {
    return inner;
  }

  return (
    <Link href={step.link} className="block min-w-0 rounded-md hover:text-primary">
      {inner}
    </Link>
  );
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
  const shown = journeyViews[contextKey] ?? journey;
  const lastIndex = shown.steps.length - 1;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-section text-foreground">Parcours client</h2>
          <p className="mt-1 text-meta text-muted">{principalLabel(shown)}</p>
          <p className="mt-1 text-meta text-muted">Les pastilles suivent les faits. L&apos;étape déclarée est séparée.</p>
        </div>
        {shown.complete ? (
          <span className="rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-badge font-semibold tracking-wide text-success uppercase">
            Complet
          </span>
        ) : null}
      </div>

      <ol className="mt-5 md:flex md:items-start">
        {shown.steps.map((step, index) => {
          const next = shown.steps[index + 1];
          const lineComplete =
            step.status === "COMPLETED" &&
            (next?.status === "COMPLETED" || next?.status === "CURRENT");

          return (
            <li
              key={step.key}
              className="relative flex gap-3 md:min-w-0 md:flex-1 md:flex-col md:items-stretch md:gap-0"
              aria-current={step.status === "CURRENT" ? "step" : undefined}
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
                <StepMarker step={step} index={index} />
                {index < lastIndex ? (
                  <span className={cn("hidden h-px flex-1 md:block", connectorClass(lineComplete))} aria-hidden="true" />
                ) : (
                  <span className="hidden flex-1 md:block" aria-hidden="true" />
                )}
              </div>

              <div className="min-w-0 flex-1 pb-5 md:mt-3 md:px-1 md:pb-0 md:text-center">
                <span className="sr-only">
                  {step.label} : {step.status}
                </span>
                <StepBody step={step} />
              </div>
            </li>
          );
        })}
      </ol>
      <JourneyStepControl
        companyId={companyId}
        opportunities={opportunities}
        projects={projects}
        contextKey={contextKey}
        onContextKeyChange={setContextKey}
        factsStep={shown.steps.find((step) => step.status === "CURRENT")?.key ?? null}
        board={board}
      />
    </Card>
  );
}
