"use client";

import { useActionState, useEffect } from "react";
import { createMaintenanceContract } from "@/actions/maintenance";
import { MaintenanceFields } from "@/components/maintenance/maintenance-fields";
import { AppDialog } from "@/components/ui/app-dialog";
import { Button } from "@/components/ui/button";
import { idleActionResult } from "@/lib/crm/action-result";
import type {
  MaintenanceCompanyOption,
  MaintenanceProjectOption,
} from "@/lib/queries/maintenance";

type CreateMaintenanceDialogProps = {
  open: boolean;
  onClose: () => void;
  companies: MaintenanceCompanyOption[];
  projects: MaintenanceProjectOption[];
  defaultCompanyId?: string;
};

export function CreateMaintenanceDialog({
  open,
  onClose,
  companies,
  projects,
  defaultCompanyId,
}: CreateMaintenanceDialogProps) {
  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="Nouveau contrat"
      description="Maintenance récurrente — montant mensuel, sans prélèvement ni facturation."
    >
      {open ? (
        <CreateMaintenanceForm
          companies={companies}
          projects={projects}
          defaultCompanyId={defaultCompanyId}
          onClose={onClose}
        />
      ) : null}
    </AppDialog>
  );
}

function CreateMaintenanceForm({
  companies,
  projects,
  defaultCompanyId,
  onClose,
}: {
  companies: MaintenanceCompanyOption[];
  projects: MaintenanceProjectOption[];
  defaultCompanyId?: string;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(createMaintenanceContract, idleActionResult);
  const firstError = (key: string) => state.fieldErrors?.[key]?.[0];

  useEffect(() => {
    if (state.ok) {
      onClose();
    }
  }, [onClose, state]);

  return (
    <form action={formAction} className="space-y-4">
      {state.message && !state.ok ? (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-meta text-danger" role="alert">
          {state.message}
        </p>
      ) : null}

      <MaintenanceFields
        pending={pending}
        firstError={firstError}
        companies={companies}
        projects={projects}
        defaults={{ companyId: defaultCompanyId ?? "" }}
        lockCompany={Boolean(defaultCompanyId)}
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onClose} disabled={pending}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Création…" : "Créer le contrat"}
        </Button>
      </div>
    </form>
  );
}
