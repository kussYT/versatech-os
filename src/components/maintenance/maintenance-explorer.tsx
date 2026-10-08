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
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[32rem] text-left">
            <caption className="px-3 py-2 text-left text-body font-medium text-foreground">
              Prochaines échéances
            </caption>
            <thead>
              <tr className="border-b border-border text-meta text-muted">
                <th className="px-3 py-2 font-medium">Entreprise</th>
                <th className="px-3 py-2 font-medium">Montant</th>
                <th className="px-3 py-2 font-medium">Échéance</th>
              </tr>
            </thead>
            <tbody>
              {overview.upcomingDues.map((due) => (
                <tr key={due.id} className="border-b border-border">
                  <td className="px-3 py-3 text-body text-foreground">{due.companyName}</td>
                  <td className="px-3 py-3 text-body tabular-nums text-foreground">{formatMoney(due.monthlyAmount)}</td>
                  <td className="px-3 py-3 text-meta text-muted">{formatDate(due.nextDueDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

          {filtered.length === 0 ? (
            <Card className="px-5">
              <EmptyState title="Aucun contrat pour ce filtre" />
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="border-b border-border text-meta text-muted">
                    <th className="px-3 py-2 font-medium">Entreprise</th>
                    <th className="px-3 py-2 font-medium">Projet</th>
                    <th className="px-3 py-2 font-medium">Montant</th>
                    <th className="px-3 py-2 font-medium">Dates</th>
                    <th className="px-3 py-2 font-medium">Statut</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((contract) => (
                    <tr key={contract.id} className="border-b border-border align-top">
                      <td className="px-3 py-3">
                        <Link
                          href={`/entreprises/${contract.company.id}`}
                          className="text-body font-medium text-primary hover:text-primary-hover"
                        >
                          {contract.company.name}
                        </Link>
                        {contract.description ? (
                          <p className="mt-1 text-meta text-muted">{contract.description}</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-meta text-muted">
                        {contract.project ? (
                          <Link href={`/projets/${contract.project.id}`} className="hover:text-foreground">
                            {contract.project.name}
                          </Link>
                        ) : (
                          "Sans projet"
                        )}
                      </td>
                      <td className="px-3 py-3 text-body tabular-nums text-foreground">
                        {formatMoney(contract.monthlyAmount)}
                        <span className="text-meta text-muted"> / mois</span>
                      </td>
                      <td className="px-3 py-3 text-meta text-muted">
                        Début {formatDate(contract.startDate)}
                        {contract.endDate ? ` · Fin ${formatDate(contract.endDate)}` : ""}
                        {contract.nextDueDate ? ` · Échéance ${formatDate(contract.nextDueDate)}` : ""}
                      </td>
                      <td className="px-3 py-3">
                        <MaintenanceStatusBadge status={contract.status} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col items-start gap-2">
                          <MaintenanceStatusActions contractId={contract.id} status={contract.status} />
                          <Button variant="ghost" size="sm" onClick={() => setEditing(contract)}>
                            Modifier
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
