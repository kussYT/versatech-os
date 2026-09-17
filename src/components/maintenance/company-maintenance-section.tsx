"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { CreateMaintenanceDialog } from "@/components/maintenance/create-maintenance-dialog";
import { EditMaintenanceDialog } from "@/components/maintenance/edit-maintenance-dialog";
import { MaintenanceStatusActions } from "@/components/maintenance/maintenance-status-actions";
import { MaintenanceStatusBadge } from "@/components/maintenance/maintenance-status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, formatMoney } from "@/lib/crm/form-data";
import type {
  MaintenanceCompanyOption,
  MaintenanceContractItem,
  MaintenanceProjectOption,
} from "@/lib/queries/maintenance";

type CompanyMaintenanceSectionProps = {
  companyId: string;
  companyName: string;
  contracts: MaintenanceContractItem[];
  projects: MaintenanceProjectOption[];
};

export function CompanyMaintenanceSection({
  companyId,
  companyName,
  contracts,
  projects,
}: CompanyMaintenanceSectionProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<MaintenanceContractItem | null>(null);

  const companies: MaintenanceCompanyOption[] = [{ id: companyId, name: companyName }];

  if (contracts.length === 0) {
    return (
      <Card className="p-5">
        <h2 className="text-section text-foreground">Maintenance</h2>
        <EmptyState
          title="Aucun contrat"
          description="Un contrat de maintenance n'encaisse rien tout seul — créez-le quand le site est en ligne."
          action={
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              Créer un contrat
            </Button>
          }
        />
        <CreateMaintenanceDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          companies={companies}
          projects={projects}
          defaultCompanyId={companyId}
        />
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-section text-foreground">Maintenance</h2>
        <Button size="sm" variant="secondary" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Ajouter
        </Button>
      </div>
      <ul className="mt-4 space-y-2">
        {contracts.map((contract) => (
          <li
            key={contract.id}
            className="flex flex-col gap-3 rounded-xl border border-border bg-background/60 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-sans text-body font-semibold tabular-nums text-foreground">
                  {formatMoney(contract.monthlyAmount)}
                  <span className="ml-1 text-meta font-normal text-muted">/ mois</span>
                </p>
                <MaintenanceStatusBadge status={contract.status} />
              </div>
              {contract.project ? (
                <Link
                  href={`/projets/${contract.project.id}`}
                  className="mt-1 inline-block text-meta text-primary hover:text-primary-hover"
                >
                  {contract.project.name}
                </Link>
              ) : null}
              <p className="mt-1 text-meta text-faint">
                Début {formatDate(contract.startDate)}
                {contract.nextDueDate ? ` · Échéance ${formatDate(contract.nextDueDate)}` : ""}
              </p>
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <MaintenanceStatusActions contractId={contract.id} status={contract.status} />
              <Button variant="ghost" size="sm" onClick={() => setEditing(contract)}>
                Modifier
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <CreateMaintenanceDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        companies={companies}
        projects={projects}
        defaultCompanyId={companyId}
      />
      <EditMaintenanceDialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        contract={editing}
        companies={companies}
        projects={projects}
      />
    </Card>
  );
}
