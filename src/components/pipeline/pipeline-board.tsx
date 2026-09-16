import { StatusBadge } from "@/components/ui/status-badge";
import { OpportunityCard } from "@/components/pipeline/opportunity-card";
import {
  OPPORTUNITY_STAGE_BADGE,
  OPPORTUNITY_STAGE_LABELS,
} from "@/lib/crm/constants";
import { formatMoney } from "@/lib/crm/form-data";
import type { PipelineColumn } from "@/lib/queries/opportunities";

type PipelineBoardProps = {
  columns: PipelineColumn[];
};

export function PipelineBoard({ columns }: PipelineBoardProps) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map((column) => (
        <section
          key={column.stage}
          aria-labelledby={`pipeline-${column.stage}`}
          className="flex w-[17.5rem] shrink-0 flex-col rounded-xl border border-border bg-background/90 p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 id={`pipeline-${column.stage}`} className="sr-only">
                {OPPORTUNITY_STAGE_LABELS[column.stage]}
              </h2>
              <StatusBadge
                status={OPPORTUNITY_STAGE_BADGE[column.stage]}
                label={OPPORTUNITY_STAGE_LABELS[column.stage]}
              />
              <p className="mt-2 font-sans text-xl font-semibold tabular-nums text-foreground">
                {column.count}
              </p>
              <p className="text-meta text-muted">
                {column.count === 0
                  ? "Vide"
                  : column.count === 1
                    ? "1 opportunité"
                    : `${column.count} opportunités`}
              </p>
            </div>
            {column.estimatedTotal > 0 ? (
              <p className="text-right text-meta tabular-nums text-muted">
                {formatMoney(column.estimatedTotal)}
                {column.weightedTotal > 0 ? (
                  <span className="mt-1 block text-[11px]">
                    Pond. {formatMoney(column.weightedTotal)}
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>

          <div className="mt-3 flex flex-col gap-2">
            {column.opportunities.length === 0 ? (
              <p className="py-4 text-meta text-muted">Aucune opportunité</p>
            ) : (
              column.opportunities.map((opportunity) => (
                <OpportunityCard key={opportunity.id} opportunity={opportunity} />
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
