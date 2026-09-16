"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Pencil } from "lucide-react";
import { EditDocumentDialog } from "@/components/documents/edit-document-dialog";
import { DocumentTypeBadge } from "@/components/documents/document-type-badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { formatDate } from "@/lib/crm/form-data";
import { cn } from "@/lib/cn";
import type {
  DocumentAssociationOption,
  DocumentProjectOption,
  DocumentRecord,
} from "@/lib/queries/documents";

type DocumentListProps = {
  documents: DocumentRecord[];
  companies: DocumentAssociationOption[];
  projects: DocumentProjectOption[];
  lockCompany?: boolean;
  lockProject?: boolean;
  compact?: boolean;
};

export function DocumentList({
  documents,
  companies,
  projects,
  lockCompany = false,
  lockProject = false,
  compact = false,
}: DocumentListProps) {
  const [editing, setEditing] = useState<DocumentRecord | null>(null);

  return (
    <>
      <ul className="mt-4 space-y-2">
        {documents.map((document) => (
          <li
            key={document.id}
            className="flex flex-col gap-3 rounded-xl border border-border bg-background/60 px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-body font-medium text-foreground">{document.name}</p>
                <DocumentTypeBadge type={document.type} />
              </div>
              <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-meta text-muted">
                {document.company ? (
                  <Link
                    href={`/entreprises/${document.company.id}`}
                    className="text-primary hover:text-primary-hover"
                  >
                    {document.company.name}
                  </Link>
                ) : (
                  <span>Sans entreprise</span>
                )}
                {document.project ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <Link
                      href={`/projets/${document.project.id}`}
                      className="text-primary hover:text-primary-hover"
                    >
                      {document.project.name}
                    </Link>
                  </>
                ) : null}
                {!compact ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-faint">{formatDate(document.createdAt)}</span>
                  </>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={document.url}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
              >
                <ExternalLink className="size-3.5" aria-hidden="true" />
                Ouvrir
              </a>
              <Button variant="ghost" size="sm" onClick={() => setEditing(document)}>
                <Pencil className="size-3.5" aria-hidden="true" />
                Modifier
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {editing ? (
        <EditDocumentDialog
          open
          onClose={() => setEditing(null)}
          document={editing}
          companies={companies}
          projects={projects}
          lockCompany={lockCompany}
          lockProject={lockProject}
        />
      ) : null}
    </>
  );
}
