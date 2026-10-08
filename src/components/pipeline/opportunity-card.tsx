"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { OPPORTUNITY_STAGE_LABELS, OPPORTUNITY_STAGES } from "@/lib/crm/constants";
import { formatMoney } from "@/lib/crm/form-data";
import { followUpCaption } from "@/lib/pipeline/kanban";
import type { PipelineOpportunityCard } from "@/lib/queries/opportunities";
import type { OpportunityStage } from "@/generated/prisma/client";

type KanbanCardProps = {
  opportunity: PipelineOpportunityCard;
  locked: boolean;
  onOpen: () => void;
  onStage: (stage: OpportunityStage) => void;
};

export function KanbanCard({ opportunity, locked, onOpen, onStage }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: opportunity.id,
    disabled: locked,
    data: { stage: opportunity.stage },
  });
  const estimated = Number(opportunity.estimatedValue);

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`rounded-lg border border-border bg-background/90 p-3 ${isDragging ? "opacity-60" : ""}`}
    >
      <button
        type="button"
        className="block w-full min-w-0 rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        onClick={onOpen}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <p className="text-body font-medium text-foreground">{opportunity.company.name}</p>
        <p className="mt-1 text-meta text-muted">{opportunity.title}</p>
        <p className="mt-2 text-body font-semibold tabular-nums text-foreground">
          {estimated > 0 ? `${formatMoney(opportunity.estimatedValue)} estimés` : "Sans estimation"}
        </p>
        {opportunity.nextFollowUp ? (
          <p className="mt-1 text-meta text-muted">{followUpCaption(opportunity.nextFollowUp.dueAt)}</p>
        ) : null}
      </button>
      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          className="min-h-12 rounded-lg border border-border px-3 text-left text-meta text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          aria-label={`Déplacer ${opportunity.company.name}`}
          disabled={locked}
          {...listeners}
          {...attributes}
        >
          Déplacer
        </button>
        <label className="block text-meta text-muted">
          Étape
          <select
            className="mt-1 min-h-12 w-full rounded-lg border border-border bg-background px-3 text-body text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            value={opportunity.stage}
            disabled={locked}
            aria-label={`Changer l'étape de ${opportunity.title}`}
            onPointerDown={(event) => event.stopPropagation()}
            onChange={(event) => onStage(event.target.value as OpportunityStage)}
          >
            {OPPORTUNITY_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {OPPORTUNITY_STAGE_LABELS[stage]}
              </option>
            ))}
          </select>
        </label>
      </div>
    </article>
  );
}

export function KanbanCardPreview({ opportunity }: { opportunity: PipelineOpportunityCard }) {
  return (
    <div className="w-[16rem] rounded-lg border border-primary/40 bg-surface p-3 shadow-lg">
      <p className="text-body font-medium text-foreground">{opportunity.company.name}</p>
      <p className="mt-1 text-meta text-muted">{opportunity.title}</p>
    </div>
  );
}
