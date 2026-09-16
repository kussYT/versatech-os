import type { Metadata } from "next";
import { DocumentExplorer } from "@/components/documents/document-explorer";
import {
  listDocumentAssociationOptions,
  listDocuments,
} from "@/lib/queries/documents";

export const metadata: Metadata = {
  title: "Documents",
};

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const [documents, associations] = await Promise.all([
    listDocuments(),
    listDocumentAssociationOptions(),
  ]);

  return (
    <DocumentExplorer
      documents={documents}
      companies={associations.companies}
      projects={associations.projects}
    />
  );
}
