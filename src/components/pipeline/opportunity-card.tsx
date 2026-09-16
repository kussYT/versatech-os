"use client";

import type { ChangeEvent } from "react";
import { useActionState, useRef } from "react";
import Link from "next/link";
import { updateOpportunityStage } from "@/actions/opportunities";
import { controlClassName } from "@/components/ui/field";
import { idleActionResult } from "@/lib/crm/action-result";
import { OPPORTUNITY_STAGE_LABELS, OPPORTUNITY_STAGES } from "@/lib/crm/constants";
import { formatDateTime, formatMoney } from "@/lib/crm/form-data";
import { INTERACTION_TYPE_LABELS } from "@/lib/crm/labels";
import type { PipelineOpportunityCard } from "@/lib/queries/opportunities";
import type { InteractionType } from "@/generated/prisma/client";

type OpportunityCardProps = {
  opportunity: PipelineOpportunityCard;
};

export function OpportunityCard({ opportunity }: OpportunityCardProps) {
  const [state, formAction, pending] = useActionState(
    updateOpportunityStage,
    idleActionResult,
  );
  const lostReasonRef = useRef<HTMLInputElement>(null);
  const estimated = Number(opportunity.estimatedValue);
  const location = [opportunity.company.industry, opportunity.company.city]
    .filter(Boolean)
    .join(" · ");

  function handleStageChange(event: ChangeEvent<HTMLSelectElement>) {
    const select = event.currentTarget;
    const nextStage = select.value;

    if (nextStage === opportunity.stage) {
      return;
    }

    if (nextStage === "WON" && !window.confirm("Passer cette opportunité en Gagné ?")) {
      select.value = opportunity.stage;
      return;
    }

    if (nextStage === "LOST") {
      const reason = window.prompt("Raison de la perte ?");
      if (!reason?.trim()) {
        select.value = opportunity.stage;
        return;
      }
      if (lostReasonRef.current) {
        lostReasonRef.current.value = reason.trim();
      }
    }

    select.form?.requestSubmit();
  }

  return (
    <article className="rounded-lg border border-border bg-background/90 p-3 motion-safe:transition-[border-color,transform] motion-safe:duration-hover motion-safe:hover:-translate-y-px hover:border-primary/40">
      <Link href={`/entreprises/${opportunity.company.id}`} className="block min-w-0">
        <p className="text-body font-medium text-foreground">{opportunity.company.name}</p>
        {location ? <p className="mt-1 text-meta text-muted">{location}</p> : null}
        <p className="mt-2 text-meta text-muted">{opportunity.title}</p>
        {estimated > 0 ? (
          <p className="mt-2 font-sans text-body font-semibold tabular-nums text-foreground">
            {formatMoney(opportunity.estimatedValue)}
          </p>
        ) : null}
        {opportunity.nextFollowUp ? (
          <p className="mt-2 text-meta text-muted">
            Relance · {formatDateTime(opportunity.nextFollowUp.dueAt)}
          </p>
        ) : null}
        {opportunity.lastInteraction ? (
          <p className="mt-1 text-meta text-faint">
            {interactionLabel(opportunity.lastInteraction.type)}
            {" · "}
            {formatDateTime(opportunity.lastInteraction.occurredAt)}
          </p>
        ) : null}
      </Link>

      <form action={formAction} className="mt-3">
        <input type="hidden" name="opportunityId" value={opportunity.id} />
        <input ref={lostReasonRef} type="hidden" name="lostReason" defaultValue="" />
        <label className="block">
          <span className="sr-only">Changer le stage</span>
          <select
            key={opportunity.stage}
            name="stage"
            defaultValue={opportunity.stage}
            disabled={pending}
            onChange={handleStageChange}
            className={controlClassName}
          >
            {OPPORTUNITY_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {OPPORTUNITY_STAGE_LABELS[stage]}
              </option>
            ))}
          </select>
        </label>
        {state.message && !state.ok ? (
          <p className="mt-2 text-meta text-danger" role="alert">
            {state.message}
          </p>
        ) : null}
      </form>
    </article>
  );
}

function interactionLabel(type: InteractionType) {
  if (type in INTERACTION_TYPE_LABELS) {
    return INTERACTION_TYPE_LABELS[type as keyof typeof INTERACTION_TYPE_LABELS];
  }

  return "Interaction";
}
