"use client";

import { useActionState, useEffect } from "react";
import { updateMaintenanceContract } from "@/actions/maintenance";
import { MaintenanceFields } from "@/components/maintenance/maintenance-fields";
import { AppDialog } from "@/components/ui/app-dialog";
import { Button } from "@/components/ui/button";
import { idleActionResult } from "@/lib/crm/action-result";
import type {
  MaintenanceCompanyOption,
  MaintenanceContractItem,
  MaintenanceProjectOption,
} from "@/lib/queries/maintenance";

type EditMaintenanceDialogProps = {
  open: boolean;
  onClose: () => void;
  contract: MaintenanceContractItem | null;
  companies: MaintenanceCompanyOption[];
  projects: MaintenanceProjectOption[];
};

export function EditMaintenanceDialog({
  open,
  onClose,
  contract,
  companies,
  projects,
}: EditMaintenanceDialogProps) {
  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="Modifier le contrat"
      description="Montant, dates et rattachement — le statut se change par les actions Activer / Suspendre / Terminer."
    >
      {open && contract ? (
        <EditMaintenanceForm
          contract={contract}
          companies={companies}
          projects={projects}
          onClose={onClose}
        />
      ) : null}
    </AppDialog>
  );
}

function EditMaintenanceForm({
  contract,
  companies,
  projects,
  onClose,
}: {
  contract: MaintenanceContractItem;
  companies: MaintenanceCompanyOption[];
  projects: MaintenanceProjectOption[];
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(updateMaintenanceContract, idleActionResult);
  const firstError = (key: string) => state.fieldErrors?.[key]?.[0];

  useEffect(() => {
    if (state.ok) {
      onClose();
    }
  }, [onClose, state]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={contract.id} />
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
        defaults={{
          companyId: contract.company.id,
          projectId: contract.project?.id ?? "",
          monthlyAmount: contract.monthlyAmount,
          startDate: contract.startDate,
          endDate: contract.endDate,
          description: contract.description,
        }}
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onClose} disabled={pending}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
