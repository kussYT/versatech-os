"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { CreateDocumentDialog } from "@/components/documents/create-document-dialog";
import { DocumentList } from "@/components/documents/document-list";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type {
  DocumentAssociationOption,
  DocumentProjectOption,
  DocumentRecord,
} from "@/lib/queries/documents";

type DocumentSectionProps = {
  documents: DocumentRecord[];
  companies: DocumentAssociationOption[];
  projects: DocumentProjectOption[];
  defaultCompanyId?: string;
  defaultProjectId?: string;
};

export function DocumentSection({
  documents,
  companies,
  projects,
  defaultCompanyId,
  defaultProjectId,
}: DocumentSectionProps) {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-section text-foreground">Documents</h2>
        <Button size="sm" variant="secondary" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Ajouter
        </Button>
      </div>
      {documents.length === 0 ? (
        <EmptyState
          title="Aucune référence"
          description="Ajoutez un lien externe (contrat, devis, livrable…) sans stocker de fichier."
          action={
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              Ajouter une référence
            </Button>
          }
        />
      ) : (
        <DocumentList
          documents={documents}
          companies={companies}
          projects={projects}
          lockCompany={Boolean(defaultCompanyId)}
          lockProject={Boolean(defaultProjectId)}
          compact
        />
      )}
      <CreateDocumentDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        companies={companies}
        projects={projects}
        defaultCompanyId={defaultCompanyId}
        defaultProjectId={defaultProjectId}
      />
    </Card>
  );
}
