"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { CreateMaintenanceDialog } from "@/components/maintenance/create-maintenance-dialog";
import { EditMaintenanceDialog } from "@/components/maintenance/edit-maintenance-dialog";
import { MaintenanceStatusActions } from "@/components/maintenance/maintenance-status-actions";
import { MaintenanceStatusBadge } from "@/components/maintenance/maintenance-status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import { PageHeader } from "@/components/layout/page-header";
import { formatDate, formatMoney } from "@/lib/crm/form-data";
import { isActiveMaintenanceStatus } from "@/lib/maintenance/status";
import type {
  MaintenanceAssociationOptions,
  MaintenanceContractItem,
  MaintenanceOverview,
} from "@/lib/queries/maintenance";

type Filter = "all" | "active" | "inactive";

type MaintenanceExplorerProps = {
  overview: MaintenanceOverview;
  associations: MaintenanceAssociationOptions;
};

export function MaintenanceExplorer({ overview, associations }: MaintenanceExplorerProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<MaintenanceContractItem | null>(null);

  const filtered = useMemo(() => {
    if (filter === "active") {
      return overview.contracts.filter((contract) => isActiveMaintenanceStatus(contract.status));
    }
    if (filter === "inactive") {
      return overview.contracts.filter((contract) => !isActiveMaintenanceStatus(contract.status));
    }
    return overview.contracts;
  }, [filter, overview.contracts]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance"
        description="Contrats récurrents, MRR et prochaines échéances indicatives — sans prélèvement ni facturation."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" aria-hidden="true" />
            Nouveau contrat
          </Button>
        }
      />

      <section aria-labelledby="maintenance-kpi-heading">
        <h2 id="maintenance-kpi-heading" className="sr-only">
          Indicateurs maintenance
        </h2>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <KpiCard
            label="MRR"
            value={formatMoney(overview.mrr)}
            hint="Contrats actifs"
            premium
            tone="gold"
          />
          <KpiCard
            label="ARR indicatif"
            value={formatMoney(overview.arr)}
            hint="MRR × 12"
            premium
            tone="prism"
          />
          <KpiCard
            label="Contrats actifs"
            value={String(overview.activeStatusCount)}
            hint={`${overview.totalCount} au total · ${overview.activeCount} dans le MRR`}
            tone="cyan"
          />
          <KpiCard
            label="Échéances 30 j"
            value={String(overview.upcomingDueCount)}
            hint="Anniversaire mensuel"
            tone="orange"
          />
        </div>
      </section>

      {overview.upcomingDues.length > 0 ? (
        <Card className="p-5">
          <h2 className="text-section text-foreground">Prochaines échéances</h2>
          <ul className="mt-4 space-y-2">
            {overview.upcomingDues.map((due) => (
              <li
                key={due.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background/60 px-4 py-3"
              >
                <div>
                  <p className="text-body font-medium text-foreground">{due.companyName}</p>
                  <p className="mt-1 font-sans text-meta tabular-nums text-muted">
                    {formatMoney(due.monthlyAmount)}
                  </p>
                </div>
                <p className="font-mono text-meta text-muted">{formatDate(due.nextDueDate)}</p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {overview.contracts.length === 0 ? (
        <Card className="px-5">
          <EmptyState
            title="Aucun contrat"
            description="Créez un contrat de maintenance pour suivre le MRR récurrent."
            action={
              <Button onClick={() => setCreateOpen(true)}>Nouveau contrat</Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer les contrats">
              <FilterButton current={filter} value="all" onSelect={setFilter}>
                Tous ({overview.totalCount})
              </FilterButton>
              <FilterButton current={filter} value="active" onSelect={setFilter}>
                Actifs ({overview.activeStatusCount})
              </FilterButton>
              <FilterButton current={filter} value="inactive" onSelect={setFilter}>
                Suspendus / terminés ({overview.totalCount - overview.activeStatusCount})
              </FilterButton>
            </div>
          </Card>

          {filtered.length === 0 ? (
            <Card className="px-5">
              <EmptyState title="Aucun contrat pour ce filtre" />
            </Card>
          ) : (
            <div className="space-y-2">
              {filtered.map((contract) => (
                <article
                  key={contract.id}
                  className="rounded-xl border border-border bg-background/90 p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/entreprises/${contract.company.id}`}
                          className="text-body font-medium text-primary hover:text-primary-hover"
                        >
                          {contract.company.name}
                        </Link>
                        <MaintenanceStatusBadge status={contract.status} />
                      </div>
                      {contract.project ? (
                        <Link
                          href={`/projets/${contract.project.id}`}
                          className="mt-1 inline-block text-meta text-muted hover:text-foreground"
                        >
                          {contract.project.name}
                        </Link>
                      ) : (
                        <p className="mt-1 text-meta text-muted">Sans projet</p>
                      )}
                      <p className="mt-2 font-sans text-body font-semibold tabular-nums text-foreground">
                        {formatMoney(contract.monthlyAmount)}
                        <span className="ml-1 text-meta font-normal text-muted">/ mois</span>
                      </p>
                      <p className="mt-1 text-meta text-faint">
                        Début {formatDate(contract.startDate)}
                        {contract.endDate ? ` · Fin ${formatDate(contract.endDate)}` : ""}
                        {contract.nextDueDate
                          ? ` · Prochaine échéance ${formatDate(contract.nextDueDate)}`
                          : ""}
                      </p>
                      {contract.description ? (
                        <p className="mt-2 text-body text-muted">{contract.description}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-start gap-2 lg:items-end">
                      <MaintenanceStatusActions contractId={contract.id} status={contract.status} />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditing(contract)}
                      >
                        Modifier
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      <CreateMaintenanceDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        companies={associations.companies}
        projects={associations.projects}
      />
      <EditMaintenanceDialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        contract={editing}
        companies={associations.companies}
        projects={associations.projects}
      />
    </div>
  );
}

function FilterButton({
  current,
  value,
  onSelect,
  children,
}: {
  current: Filter;
  value: Filter;
  onSelect: (value: Filter) => void;
  children: ReactNode;
}) {
  const selected = current === value;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      aria-pressed={selected}
      className={
        selected
          ? "rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-meta font-medium text-primary"
          : "rounded-full border border-border bg-background px-3 py-1.5 text-meta text-muted hover:text-foreground"
      }
    >
      {children}
    </button>
  );
}
