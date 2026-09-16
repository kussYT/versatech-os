"use client";

import { useActionState, useEffect } from "react";
import { updateDocument } from "@/actions/documents";
import { DocumentFields } from "@/components/documents/document-fields";
import { AppDialog } from "@/components/ui/app-dialog";
import { Button } from "@/components/ui/button";
import { idleActionResult } from "@/lib/crm/action-result";
import type {
  DocumentAssociationOption,
  DocumentProjectOption,
  DocumentRecord,
} from "@/lib/queries/documents";

type EditDocumentDialogProps = {
  open: boolean;
  onClose: () => void;
  document: DocumentRecord;
  companies: DocumentAssociationOption[];
  projects: DocumentProjectOption[];
  lockCompany?: boolean;
  lockProject?: boolean;
};

export function EditDocumentDialog({
  open,
  onClose,
  document,
  companies,
  projects,
  lockCompany = false,
  lockProject = false,
}: EditDocumentDialogProps) {
  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="Modifier la référence"
      description="Mise à jour des métadonnées et du lien externe."
    >
      {open ? (
        <EditDocumentForm
          document={document}
          companies={companies}
          projects={projects}
          lockCompany={lockCompany}
          lockProject={lockProject}
          onClose={onClose}
        />
      ) : null}
    </AppDialog>
  );
}

function EditDocumentForm({
  document,
  companies,
  projects,
  lockCompany,
  lockProject,
  onClose,
}: {
  document: DocumentRecord;
  companies: DocumentAssociationOption[];
  projects: DocumentProjectOption[];
  lockCompany: boolean;
  lockProject: boolean;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(updateDocument, idleActionResult);
  const firstError = (key: string) => state.fieldErrors?.[key]?.[0];

  useEffect(() => {
    if (state.ok) {
      onClose();
    }
  }, [onClose, state]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={document.id} />
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
          name: document.name,
          type: document.type,
          url: document.url,
          companyId: document.company?.id ?? "",
          projectId: document.project?.id ?? "",
        }}
        lockCompany={lockCompany}
        lockProject={lockProject}
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
