"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { CreateDocumentDialog } from "@/components/documents/create-document-dialog";
import { DocumentList } from "@/components/documents/document-list";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { controlClassName } from "@/components/ui/field";
import { PageHeader } from "@/components/layout/page-header";
import { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPES } from "@/lib/crm/constants";
import type {
  DocumentAssociationOption,
  DocumentProjectOption,
  DocumentRecord,
} from "@/lib/queries/documents";
import { cn } from "@/lib/cn";

type DocumentExplorerProps = {
  documents: DocumentRecord[];
  companies: DocumentAssociationOption[];
  projects: DocumentProjectOption[];
};

export function DocumentExplorer({
  documents,
  companies,
  projects,
}: DocumentExplorerProps) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [companyId, setCompanyId] = useState("all");
  const [projectId, setProjectId] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);

  const companyOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const document of documents) {
      if (document.company) {
        map.set(document.company.id, document.company.name);
      }
    }
    return [...map.entries()].sort((left, right) => left[1].localeCompare(right[1], "fr"));
  }, [documents]);

  const projectOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const document of documents) {
      if (document.project && (companyId === "all" || document.company?.id === companyId)) {
        map.set(document.project.id, document.project.name);
      }
    }
    return [...map.entries()].sort((left, right) => left[1].localeCompare(right[1], "fr"));
  }, [companyId, documents]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return documents.filter((document) => {
      if (type !== "all" && document.type !== type) {
        return false;
      }
      if (companyId !== "all" && document.company?.id !== companyId) {
        return false;
      }
      if (projectId !== "all" && document.project?.id !== projectId) {
        return false;
      }
      if (!needle) {
        return true;
      }
      const haystack = [
        document.name,
        DOCUMENT_TYPE_LABELS[document.type],
        document.company?.name,
        document.project?.name,
        document.url,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [companyId, documents, projectId, query, type]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Registre des références documentaires : métadonnées et URL externe, sans stockage de fichiers."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" aria-hidden="true" />
            Ajouter une référence
          </Button>
        }
      />

      {documents.length === 0 ? (
        <Card className="px-5">
          <EmptyState
            title="Aucune référence"
            description="Ajoutez un lien vers un contrat, un devis ou un livrable déjà hébergé ailleurs."
            action={
              <Button onClick={() => setCreateOpen(true)}>Ajouter une référence</Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
              <label className="relative block">
                <span className="sr-only">Rechercher</span>
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
                  aria-hidden="true"
                />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Nom, entreprise, projet, URL"
                  className={cn(controlClassName, "pl-9")}
                />
              </label>
              <label className="block">
                <span className="sr-only">Type</span>
                <select
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                  className={controlClassName}
                >
                  <option value="all">Type · tous</option>
                  {DOCUMENT_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {DOCUMENT_TYPE_LABELS[value]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="sr-only">Entreprise</span>
                <select
                  value={companyId}
                  onChange={(event) => {
                    setCompanyId(event.target.value);
                    setProjectId("all");
                  }}
                  className={controlClassName}
                >
                  <option value="all">Entreprise · toutes</option>
                  {companyOptions.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="sr-only">Projet</span>
                <select
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value)}
                  className={controlClassName}
                >
                  <option value="all">Projet · tous</option>
                  {projectOptions.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </Card>

          {filtered.length === 0 ? (
            <Card className="px-5">
              <EmptyState
                title="Aucun résultat"
                description="Aucune référence ne correspond aux filtres."
              />
            </Card>
          ) : (
            <DocumentList documents={filtered} companies={companies} projects={projects} />
          )}
        </div>
      )}

      <CreateDocumentDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        companies={companies}
        projects={projects}
      />
    </div>
  );
}
