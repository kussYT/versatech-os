import { InteractiveCard } from "@/components/ui/interactive-card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  OPPORTUNITY_STAGE_BADGE,
  OPPORTUNITY_STAGE_LABELS,
  OPPORTUNITY_STAGES,
} from "@/lib/crm/constants";
import { formatMoney } from "@/lib/crm/form-data";
import type { PipelineOverview } from "@/lib/queries/opportunities";
import Link from "next/link";

type PipelinePreviewProps = {
  overview: PipelineOverview;
};

export function PipelinePreview({ overview }: PipelinePreviewProps) {
  return (
    <InteractiveCard className="has-pipeline-aurora p-4 sm:p-5">
      <span className="pipeline-aurora" aria-hidden="true">
        <span className="pipeline-aurora-veil pipeline-aurora-blue" />
        <span className="pipeline-aurora-veil pipeline-aurora-cyan" />
        <span className="pipeline-aurora-veil pipeline-aurora-violet" />
      </span>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-section text-foreground">Pipeline</h2>
          <p className="mt-1 text-meta text-muted">
            {overview.openCount === 0
              ? "Aucune opportunité ouverte"
              : overview.openCount === 1
                ? "1 opportunité ouverte"
                : `${overview.openCount} opportunités ouvertes`}
            {overview.weightedTotal > 0
              ? ` · pondéré ${formatMoney(overview.weightedTotal)}`
              : ""}
          </p>
        </div>
        <Link href="/pipeline" className="text-meta text-primary hover:text-primary-hover">
          Voir le pipeline
        </Link>
      </div>
      <div className="mt-4 hidden gap-2 overflow-x-auto pb-1 md:flex">
        {OPPORTUNITY_STAGES.map((stage) => {
          const count = overview.counts[stage];
          return (
            <div
              key={stage}
              className="min-w-[8.25rem] flex-1 rounded-lg border border-border bg-background/90 p-3 motion-safe:transition-[border-color,transform] motion-safe:duration-hover motion-safe:hover:-translate-y-px hover:border-primary/40"
            >
              <StatusBadge
                status={OPPORTUNITY_STAGE_BADGE[stage]}
                label={OPPORTUNITY_STAGE_LABELS[stage]}
              />
              <p className="mt-3 font-sans text-xl font-semibold tabular-nums text-foreground">
                {count}
              </p>
              <p className="text-meta text-muted">
                {count === 0 ? "Vide" : count > 1 ? "Opportunités" : "Opportunité"}
              </p>
            </div>
          );
        })}
      </div>
      <div className="md:hidden">
        <EmptyState
          title={
            overview.openCount === 0
              ? "Aucune opportunité ouverte"
              : `${overview.openCount} opportunité${overview.openCount > 1 ? "s" : ""}`
          }
        />
        <ul className="flex flex-wrap gap-1.5">
          {OPPORTUNITY_STAGES.map((stage) => (
            <li key={stage}>
              <StatusBadge
                status={OPPORTUNITY_STAGE_BADGE[stage]}
                label={`${OPPORTUNITY_STAGE_LABELS[stage]} · ${overview.counts[stage]}`}
              />
            </li>
          ))}
        </ul>
      </div>
    </InteractiveCard>
  );
}
