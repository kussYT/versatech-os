"use server";

import type { ActionResult } from "@/lib/crm/action-result";
import { requireActor } from "@/lib/crm/actor";
import { readString } from "@/lib/crm/form-data";
import { revalidateDocuments } from "@/lib/crm/revalidate";
import { prisma } from "@/lib/db/prisma";
import {
  createDocumentSchema,
  fieldErrorsFromZod,
  updateDocumentSchema,
} from "@/lib/validations/document";

type DocumentLinks = {
  companyId: string | null;
  projectId: string | null;
  opportunityId: string | null;
};

async function resolveDocumentLinks(input: {
  companyId: string | null;
  projectId: string | null;
}): Promise<DocumentLinks | { error: string }> {
  if (input.projectId) {
    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
      select: { id: true, companyId: true, opportunityId: true },
    });

    if (!project) {
      return { error: "Projet introuvable." };
    }

    if (input.companyId && input.companyId !== project.companyId) {
      return { error: "Ce projet n'appartient pas à l'entreprise sélectionnée." };
    }

    return {
      companyId: project.companyId,
      projectId: project.id,
      opportunityId: project.opportunityId,
    };
  }

  if (input.companyId) {
    const company = await prisma.company.findUnique({
      where: { id: input.companyId },
      select: { id: true },
    });

    if (!company) {
      return { error: "Entreprise introuvable." };
    }

    return {
      companyId: company.id,
      projectId: null,
      opportunityId: null,
    };
  }

  return {
    companyId: null,
    projectId: null,
    opportunityId: null,
  };
}

export async function createDocument(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }
  const { actor } = auth;
  const parsed = createDocumentSchema.safeParse({
    name: readString(formData, "name"),
    type: readString(formData, "type"),
    url: readString(formData, "url"),
    companyId: readString(formData, "companyId"),
    projectId: readString(formData, "projectId"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Vérifiez les champs du formulaire.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const input = parsed.data;

  try {
    const links = await resolveDocumentLinks({
      companyId: input.companyId,
      projectId: input.projectId,
    });

    if ("error" in links) {
      return { ok: false, message: links.error };
    }

    const document = await prisma.$transaction(async (tx) => {
      const created = await tx.document.create({
        data: {
          name: input.name,
          type: input.type,
          url: input.url,
          companyId: links.companyId,
          projectId: links.projectId,
          opportunityId: links.opportunityId,
        },
      });

      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          entityType: "Document",
          entityId: created.id,
          action: "document.created",
          metadata: {
            name: created.name,
            type: created.type,
            companyId: links.companyId,
            projectId: links.projectId,
          },
        },
      });

      return created;
    });

    revalidateDocuments(links.companyId, links.projectId);
    return {
      ok: true,
      data: {
        documentId: document.id,
        companyId: links.companyId ?? undefined,
        projectId: links.projectId ?? undefined,
      },
    };
  } catch (error) {
    console.error(error);
    return { ok: false, message: "Impossible de créer la référence. Réessayez." };
  }
}

export async function updateDocument(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }
  const { actor } = auth;
  const parsed = updateDocumentSchema.safeParse({
    id: readString(formData, "id"),
    name: readString(formData, "name"),
    type: readString(formData, "type"),
    url: readString(formData, "url"),
    companyId: readString(formData, "companyId"),
    projectId: readString(formData, "projectId"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Vérifiez les champs du formulaire.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const input = parsed.data;

  try {
    const existing = await prisma.document.findUnique({
      where: { id: input.id },
    });

    if (!existing) {
      return { ok: false, message: "Document introuvable." };
    }

    const links = await resolveDocumentLinks({
      companyId: input.companyId,
      projectId: input.projectId,
    });

    if ("error" in links) {
      return { ok: false, message: links.error };
    }

    await prisma.$transaction(async (tx) => {
      await tx.document.update({
        where: { id: existing.id },
        data: {
          name: input.name,
          type: input.type,
          url: input.url,
          companyId: links.companyId,
          projectId: links.projectId,
          opportunityId: links.opportunityId,
        },
      });

      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          entityType: "Document",
          entityId: existing.id,
          action: "document.updated",
          metadata: {
            name: input.name,
            type: input.type,
            companyId: links.companyId,
            projectId: links.projectId,
          },
        },
      });
    });

    revalidateDocuments(existing.companyId, existing.projectId);
    revalidateDocuments(links.companyId, links.projectId);
    return {
      ok: true,
      data: {
        documentId: existing.id,
        companyId: links.companyId ?? undefined,
        projectId: links.projectId ?? undefined,
      },
    };
  } catch (error) {
    console.error(error);
    return { ok: false, message: "Impossible de mettre à jour la référence. Réessayez." };
  }
}
