"use server";

import type { ActionResult } from "@/lib/crm/action-result";
import { getActorUser } from "@/lib/crm/actor";
import { readString } from "@/lib/crm/form-data";
import { revalidateProjects } from "@/lib/crm/revalidate";
import { prisma } from "@/lib/db/prisma";
import {
  createProjectSchema,
  fieldErrorsFromZod,
  updateProjectStatusSchema,
} from "@/lib/validations/project";
import type { ProjectStatus } from "@/generated/prisma/client";

export async function createProject(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = createProjectSchema.safeParse({
    companyId: readString(formData, "companyId"),
    name: readString(formData, "name"),
    status: readString(formData, "status"),
    startDate: readString(formData, "startDate"),
    dueDate: readString(formData, "dueDate"),
    amount: readString(formData, "amount"),
    description: readString(formData, "description"),
    quoteId: readString(formData, "quoteId"),
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
    const company = await prisma.company.findUnique({
      where: { id: input.companyId },
    });

    if (!company) {
      return { ok: false, message: "Entreprise introuvable." };
    }

    if (company.lifecycleStatus !== "CLIENT") {
      return { ok: false, message: "Un projet se crée depuis une entreprise cliente." };
    }

    const quote = input.quoteId
      ? await prisma.quote.findUnique({ where: { id: input.quoteId } })
      : null;

    if (input.quoteId && (!quote || quote.companyId !== company.id || quote.status !== "ACCEPTED")) {
      return { ok: false, message: "Devis accepté introuvable pour cette entreprise." };
    }

    if (quote?.projectId) {
      return { ok: false, message: "Ce devis est déjà associé à un projet." };
    }

    const actor = await getActorUser();

    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          companyId: company.id,
          opportunityId: quote?.opportunityId ?? null,
          name: input.name,
          status: input.status,
          description: input.description,
          startDate: input.startDate,
          dueDate: input.dueDate,
          amount: input.amount,
        },
      });

      if (quote) {
        await tx.quote.update({
          where: { id: quote.id },
          data: { projectId: created.id },
        });
      }

      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          entityType: "Project",
          entityId: created.id,
          action: "project.created",
          metadata: {
            companyId: company.id,
            quoteId: quote?.id ?? null,
          },
        },
      });

      return created;
    });

    revalidateProjects(company.id, project.id);
    return { ok: true, data: { projectId: project.id, companyId: company.id } };
  } catch (error) {
    console.error(error);
    return { ok: false, message: "Impossible de créer le projet. Réessayez." };
  }
}

const ALLOWED_PROJECT_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  PLANNED: ["ACTIVE"],
  ACTIVE: ["WAITING_CLIENT", "REVIEW", "COMPLETED"],
  WAITING_CLIENT: ["ACTIVE", "REVIEW"],
  REVIEW: ["ACTIVE", "COMPLETED"],
  COMPLETED: ["ARCHIVED"],
  ARCHIVED: [],
};

export async function updateProjectStatus(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = updateProjectStatusSchema.safeParse({
    projectId: readString(formData, "projectId"),
    status: readString(formData, "status"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Statut de projet invalide.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const input = parsed.data;

  try {
    const existing = await prisma.project.findUnique({
      where: { id: input.projectId },
    });

    if (!existing) {
      return { ok: false, message: "Projet introuvable." };
    }

    if (existing.status === input.status) {
      return {
        ok: true,
        data: { projectId: existing.id, companyId: existing.companyId },
      };
    }

    if (!ALLOWED_PROJECT_TRANSITIONS[existing.status].includes(input.status)) {
      return { ok: false, message: "Cette transition n'est pas autorisée." };
    }

    const actor = await getActorUser();

    await prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: existing.id },
        data: {
          status: input.status,
          completedAt:
            input.status === "COMPLETED" ? new Date() : existing.completedAt,
        },
      });

      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          entityType: "Project",
          entityId: existing.id,
          action: "project.status_changed",
          metadata: {
            companyId: existing.companyId,
            fromStatus: existing.status,
            toStatus: input.status,
          },
        },
      });
    });

    revalidateProjects(existing.companyId, existing.id);
    return { ok: true, data: { projectId: existing.id, companyId: existing.companyId } };
  } catch (error) {
    console.error(error);
    return { ok: false, message: "Impossible de mettre à jour le projet. Réessayez." };
  }
}
