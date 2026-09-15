import { InteractiveCard } from "@/components/ui/interactive-card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";

const stages = [
  { id: "to-qualify", status: "prospect" as const, label: "À qualifier" },
  { id: "to-contact", status: "prospect" as const, label: "À contacter" },
  { id: "contacted", status: "contacted" as const, label: "Contacté" },
  { id: "interested", status: "interested" as const, label: "Intéressé" },
  { id: "meeting", status: "meeting" as const, label: "RDV" },
  { id: "quote", status: "quote" as const, label: "Devis" },
  { id: "won", status: "won" as const, label: "Gagné" },
  { id: "lost", status: "lost" as const, label: "Perdu" },
];

export function PipelinePreview() {
  return (
    <InteractiveCard className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-section text-foreground">Pipeline</h2>
          <p className="mt-1 text-meta text-muted">Le pipeline apparaîtra ici</p>
        </div>
        <p className="hidden max-w-[11rem] text-right text-meta text-muted sm:block">
          Suivez l&apos;avancement de vos opportunités.
        </p>
      </div>
      <div className="mt-4 hidden gap-2 overflow-x-auto pb-1 md:flex">
        {stages.map((stage) => (
          <div
            key={stage.id}
            className="min-w-[8.25rem] flex-1 rounded-lg border border-border bg-background/80 p-3"
          >
            <StatusBadge status={stage.status} label={stage.label} />
            <p className="mt-3 font-sans text-xl font-semibold tabular-nums text-foreground">
              0
            </p>
            <p className="text-meta text-muted">Vide</p>
          </div>
        ))}
      </div>
      <div className="md:hidden">
        <EmptyState title="Le pipeline apparaîtra ici" />
        <ul className="flex flex-wrap gap-1.5">
          {stages.map((stage) => (
            <li key={stage.id}>
              <StatusBadge status={stage.status} label={stage.label} />
            </li>
          ))}
        </ul>
      </div>
    </InteractiveCard>
  );
}
