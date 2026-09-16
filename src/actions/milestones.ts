"use server";

import type { MilestoneStatus } from "@/generated/prisma/client";
import type { ActionResult } from "@/lib/crm/action-result";
import { getActorUser } from "@/lib/crm/actor";
import { readString } from "@/lib/crm/form-data";
import { revalidateProjects } from "@/lib/crm/revalidate";
import { prisma } from "@/lib/db/prisma";
import {
  createMilestoneSchema,
  fieldErrorsFromZod,
  updateMilestoneStatusSchema,
} from "@/lib/validations/milestone";

const ALLOWED_MILESTONE_TRANSITIONS: Record<MilestoneStatus, MilestoneStatus[]> = {
  PENDING: ["DONE", "CANCELED"],
  DONE: [],
  CANCELED: [],
};

export async function createMilestone(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = createMilestoneSchema.safeParse({
    projectId: readString(formData, "projectId"),
    name: readString(formData, "name"),
    dueAt: readString(formData, "dueAt"),
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
    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
    });

    if (!project) {
      return { ok: false, message: "Projet introuvable." };
    }

    const actor = await getActorUser();

    const milestone = await prisma.$transaction(async (tx) => {
      const created = await tx.milestone.create({
        data: {
          projectId: project.id,
          name: input.name,
          dueAt: input.dueAt,
          status: "PENDING",
        },
      });

      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          entityType: "Milestone",
          entityId: created.id,
          action: "milestone.created",
          metadata: { projectId: project.id, companyId: project.companyId },
        },
      });

      return created;
    });

    revalidateProjects(project.companyId, project.id);
    return {
      ok: true,
      data: { milestoneId: milestone.id, projectId: project.id, companyId: project.companyId },
    };
  } catch (error) {
    console.error(error);
    return { ok: false, message: "Impossible de créer le jalon. Réessayez." };
  }
}

export async function updateMilestoneStatus(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = updateMilestoneStatusSchema.safeParse({
    milestoneId: readString(formData, "milestoneId"),
    status: readString(formData, "status"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Statut de jalon invalide.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const input = parsed.data;

  try {
    const existing = await prisma.milestone.findUnique({
      where: { id: input.milestoneId },
      include: { project: { select: { companyId: true } } },
    });

    if (!existing) {
      return { ok: false, message: "Jalon introuvable." };
    }

    if (existing.status === input.status) {
      return {
        ok: true,
        data: {
          milestoneId: existing.id,
          projectId: existing.projectId,
          companyId: existing.project.companyId,
        },
      };
    }

    if (!ALLOWED_MILESTONE_TRANSITIONS[existing.status].includes(input.status)) {
      return { ok: false, message: "Cette transition n'est pas autorisée." };
    }

    const actor = await getActorUser();

    await prisma.$transaction(async (tx) => {
      await tx.milestone.update({
        where: { id: existing.id },
        data: {
          status: input.status,
          completedAt: input.status === "DONE" ? new Date() : existing.completedAt,
        },
      });

      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          entityType: "Milestone",
          entityId: existing.id,
          action: "milestone.status_changed",
          metadata: {
            projectId: existing.projectId,
            fromStatus: existing.status,
            toStatus: input.status,
          },
        },
      });
    });

    revalidateProjects(existing.project.companyId, existing.projectId);
    return {
      ok: true,
      data: {
        milestoneId: existing.id,
        projectId: existing.projectId,
        companyId: existing.project.companyId,
      },
    };
  } catch (error) {
    console.error(error);
    return { ok: false, message: "Impossible de mettre à jour le jalon. Réessayez." };
  }
}
