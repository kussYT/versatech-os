import "server-only";

import type { DocumentType } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

export type DocumentRecord = {
  id: string;
  name: string;
  type: DocumentType;
  url: string;
  createdAt: string;
  company: {
    id: string;
    name: string;
  } | null;
  project: {
    id: string;
    name: string;
    companyId: string;
  } | null;
};

export type DocumentAssociationOption = {
  id: string;
  name: string;
};

export type DocumentProjectOption = DocumentAssociationOption & {
  companyId: string;
};

export type DocumentAssociationOptions = {
  companies: DocumentAssociationOption[];
  projects: DocumentProjectOption[];
};

const documentInclude = {
  company: { select: { id: true, name: true } },
  project: { select: { id: true, name: true, companyId: true } },
} as const;

function toDocumentRecord(
  document: {
    id: string;
    name: string;
    type: DocumentType;
    url: string;
    createdAt: Date;
    company: { id: string; name: string } | null;
    project: { id: string; name: string; companyId: string } | null;
  },
): DocumentRecord {
  return {
    id: document.id,
    name: document.name,
    type: document.type,
    url: document.url,
    createdAt: document.createdAt.toISOString(),
    company: document.company,
    project: document.project,
  };
}

export async function listDocuments(): Promise<DocumentRecord[]> {
  const documents = await prisma.document.findMany({
    orderBy: [{ createdAt: "desc" }, { name: "asc" }],
    include: documentInclude,
  });

  return documents.map(toDocumentRecord);
}

export async function listDocumentsForCompany(companyId: string): Promise<DocumentRecord[]> {
  const documents = await prisma.document.findMany({
    where: { companyId },
    orderBy: [{ createdAt: "desc" }, { name: "asc" }],
    include: documentInclude,
  });

  return documents.map(toDocumentRecord);
}

export async function listDocumentsForProject(projectId: string): Promise<DocumentRecord[]> {
  const documents = await prisma.document.findMany({
    where: { projectId },
    orderBy: [{ createdAt: "desc" }, { name: "asc" }],
    include: documentInclude,
  });

  return documents.map(toDocumentRecord);
}

export async function listDocumentAssociationOptions(): Promise<DocumentAssociationOptions> {
  const [companies, projects] = await Promise.all([
    prisma.company.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.project.findMany({
      select: { id: true, name: true, companyId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return { companies, projects };
}
