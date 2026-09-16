"use server";

import type { TaskStatus } from "@/generated/prisma/client";
import type { ActionResult } from "@/lib/crm/action-result";
import { getActorUser } from "@/lib/crm/actor";
import { readString } from "@/lib/crm/form-data";
import { revalidateProjects } from "@/lib/crm/revalidate";
import { prisma } from "@/lib/db/prisma";
import {
  createTaskSchema,
  fieldErrorsFromZod,
  updateTaskStatusSchema,
} from "@/lib/validations/task";

const ALLOWED_TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  TODO: ["IN_PROGRESS", "CANCELED"],
  IN_PROGRESS: ["DONE", "TODO", "CANCELED"],
  DONE: [],
  CANCELED: [],
};

export async function createTask(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = createTaskSchema.safeParse({
    projectId: readString(formData, "projectId"),
    title: readString(formData, "title"),
    priority: readString(formData, "priority") || "NORMAL",
    dueAt: readString(formData, "dueAt"),
    description: readString(formData, "description"),
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

    const task = await prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          title: input.title,
          description: input.description,
          status: "TODO",
          priority: input.priority,
          dueAt: input.dueAt,
          companyId: project.companyId,
          opportunityId: project.opportunityId,
          projectId: project.id,
          assignedToId: actor.id,
        },
      });

      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          entityType: "Task",
          entityId: created.id,
          action: "task.created",
          metadata: { projectId: project.id, companyId: project.companyId },
        },
      });

      return created;
    });

    revalidateProjects(project.companyId, project.id);
    return { ok: true, data: { taskId: task.id, projectId: project.id, companyId: project.companyId } };
  } catch (error) {
    console.error(error);
    return { ok: false, message: "Impossible de créer la tâche. Réessayez." };
  }
}

export async function updateTaskStatus(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = updateTaskStatusSchema.safeParse({
    taskId: readString(formData, "taskId"),
    status: readString(formData, "status"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Statut de tâche invalide.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const input = parsed.data;

  try {
    const existing = await prisma.task.findUnique({
      where: { id: input.taskId },
    });

    if (!existing) {
      return { ok: false, message: "Tâche introuvable." };
    }

    if (existing.status === input.status) {
      return {
        ok: true,
        data: {
          taskId: existing.id,
          projectId: existing.projectId ?? undefined,
          companyId: existing.companyId ?? undefined,
        },
      };
    }

    if (!ALLOWED_TASK_TRANSITIONS[existing.status].includes(input.status)) {
      return { ok: false, message: "Cette transition n'est pas autorisée." };
    }

    const actor = await getActorUser();

    await prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id: existing.id },
        data: {
          status: input.status,
          completedAt: input.status === "DONE" ? new Date() : existing.completedAt,
        },
      });

      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          entityType: "Task",
          entityId: existing.id,
          action: "task.status_changed",
          metadata: {
            projectId: existing.projectId,
            fromStatus: existing.status,
            toStatus: input.status,
          },
        },
      });
    });

    revalidateProjects(existing.companyId ?? undefined, existing.projectId ?? undefined);
    return {
      ok: true,
      data: {
        taskId: existing.id,
        projectId: existing.projectId ?? undefined,
        companyId: existing.companyId ?? undefined,
      },
    };
  } catch (error) {
    console.error(error);
    return { ok: false, message: "Impossible de mettre à jour la tâche. Réessayez." };
  }
}
