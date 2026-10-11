"use server";

import { logServerError } from "@/lib/observability/log-error";

import type { ActionResult } from "@/lib/crm/action-result";
import { requireActor } from "@/lib/crm/actor";
import { readString } from "@/lib/crm/form-data";
import { revalidateProjects } from "@/lib/crm/revalidate";
import { parseDate } from "@/lib/dates";
import { prisma } from "@/lib/db/prisma";
import { startDateAfterDemarrer, validateExplicitStartDate } from "@/lib/projects/start";
import {
  adoptDeclaredJourneyForProject,
  isMissingJourneySchema,
  type JourneyWriteTx,
} from "@/lib/services/journey/write";
import {
  createProjectSchema,
  fieldErrorsFromZod,
  updateProjectStartDateSchema,
  updateProjectStatusSchema,
} from "@/lib/validations/project";
import type { ProjectStatus } from "@/generated/prisma/client";

export async function createProject(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }
  const { actor } = auth;
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

      if (created.opportunityId) {
        try {
          await adoptDeclaredJourneyForProject(tx as unknown as JourneyWriteTx, {
            actorId: actor.id,
            companyId: company.id,
            opportunityId: created.opportunityId,
            projectId: created.id,
          });
        } catch (error) {
          if (!isMissingJourneySchema(error)) {
            throw error;
          }
        }
      }

      return created;
    });

    revalidateProjects(company.id, project.id);
    return { ok: true, data: { projectId: project.id, companyId: company.id } };
  } catch (error) {
    logServerError("projects", error);
    return { ok: false, message: "Impossible de créer le projet. Réessayez." };
  }
}

const ALLOWED_PROJECT_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  PLANNED: ["ACTIVE", "ABANDONED"],
  ACTIVE: ["WAITING_CLIENT", "REVIEW", "COMPLETED", "ABANDONED"],
  WAITING_CLIENT: ["ACTIVE", "REVIEW", "ABANDONED"],
  REVIEW: ["ACTIVE", "COMPLETED", "ABANDONED"],
  COMPLETED: ["ARCHIVED"],
  ARCHIVED: [],
  ABANDONED: [],
};

export async function updateProjectStatus(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }
  const { actor } = auth;
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

    const now = new Date();
    const startDate = startDateAfterDemarrer({
      fromStatus: existing.status,
      toStatus: input.status,
      startDate: existing.startDate,
      now,
    });

    await prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: existing.id },
        data: {
          status: input.status,
          startDate,
          completedAt:
            input.status === "COMPLETED" ? now : existing.completedAt,
          abandonedAt:
            input.status === "ABANDONED" ? now : existing.abandonedAt,
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
            startDate: startDate?.toISOString() ?? null,
          },
        },
      });
    });

    revalidateProjects(existing.companyId, existing.id);
    return {
      ok: true,
      message: input.status === "ACTIVE" && existing.status === "PLANNED" ? "Projet démarré." : "Projet mis à jour.",
      data: { projectId: existing.id, companyId: existing.companyId },
    };
  } catch (error) {
    logServerError("projects", error);
    return { ok: false, message: "Impossible de mettre à jour le projet. Réessayez." };
  }
}

export async function updateProjectStartDate(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }
  const { actor } = auth;
  const parsed = updateProjectStartDateSchema.safeParse({
    projectId: readString(formData, "projectId"),
    startDate: readString(formData, "startDate"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Date de début invalide.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const startDate = parseDate(parsed.data.startDate);
  if (!startDate) {
    return { ok: false, message: "Date de début invalide." };
  }

  try {
    const existing = await prisma.project.findUnique({
      where: { id: parsed.data.projectId },
    });

    if (!existing) {
      return { ok: false, message: "Projet introuvable." };
    }

    const allowed = validateExplicitStartDate({
      status: existing.status,
      startDate,
      now: new Date(),
    });
    if (!allowed.ok) {
      return { ok: false, message: allowed.message };
    }

    await prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: existing.id },
        data: { startDate },
      });
      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          entityType: "Project",
          entityId: existing.id,
          action: "project.start_date_changed",
          metadata: {
            companyId: existing.companyId,
            from: existing.startDate?.toISOString() ?? null,
            to: startDate.toISOString(),
          },
        },
      });
    });

    revalidateProjects(existing.companyId, existing.id);
    return {
      ok: true,
      message: "Date de début enregistrée.",
      data: { projectId: existing.id, companyId: existing.companyId },
    };
  } catch (error) {
    logServerError("projects", error);
    return { ok: false, message: "Impossible d'enregistrer la date de début. Réessayez." };
  }
}
