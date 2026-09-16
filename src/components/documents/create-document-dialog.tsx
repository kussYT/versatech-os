"use client";

import { useActionState, useEffect } from "react";
import { createDocument } from "@/actions/documents";
import { DocumentFields } from "@/components/documents/document-fields";
import { AppDialog } from "@/components/ui/app-dialog";
import { Button } from "@/components/ui/button";
import { idleActionResult } from "@/lib/crm/action-result";
import type {
  DocumentAssociationOption,
  DocumentProjectOption,
} from "@/lib/queries/documents";

type CreateDocumentDialogProps = {
  open: boolean;
  onClose: () => void;
  companies: DocumentAssociationOption[];
  projects: DocumentProjectOption[];
  defaultCompanyId?: string;
  defaultProjectId?: string;
};

export function CreateDocumentDialog({
  open,
  onClose,
  companies,
  projects,
  defaultCompanyId,
  defaultProjectId,
}: CreateDocumentDialogProps) {
  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="Ajouter une référence"
      description="Registre documentaire : nom, type et URL externe. Pas de stockage de fichier."
    >
      {open ? (
        <CreateDocumentForm
          companies={companies}
          projects={projects}
          defaultCompanyId={defaultCompanyId}
          defaultProjectId={defaultProjectId}
          onClose={onClose}
        />
      ) : null}
    </AppDialog>
  );
}

function CreateDocumentForm({
  companies,
  projects,
  defaultCompanyId,
  defaultProjectId,
  onClose,
}: {
  companies: DocumentAssociationOption[];
  projects: DocumentProjectOption[];
  defaultCompanyId?: string;
  defaultProjectId?: string;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(createDocument, idleActionResult);
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

      <DocumentFields
        pending={pending}
        firstError={firstError}
        companies={companies}
        projects={projects}
        defaults={{
          companyId: defaultCompanyId ?? "",
          projectId: defaultProjectId ?? "",
        }}
        lockCompany={Boolean(defaultCompanyId)}
        lockProject={Boolean(defaultProjectId)}
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onClose} disabled={pending}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Création…" : "Ajouter la référence"}
        </Button>
      </div>
    </form>
  );
}
