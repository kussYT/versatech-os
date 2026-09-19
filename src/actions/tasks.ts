"use server";

import { logServerError } from "@/lib/observability/log-error";

import type { ActionResult } from "@/lib/crm/action-result";
import { requireActor } from "@/lib/crm/actor";
import { readString } from "@/lib/crm/form-data";
import { revalidateProjects } from "@/lib/crm/revalidate";
import {
  createTaskSchema,
  fieldErrorsFromZod,
  updateTaskStatusSchema,
} from "@/lib/validations/task";
import { TaskService } from "@/lib/services/tasks";
import { toActionResult } from "@/lib/services/_shared/result";

export async function createTask(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }
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

  try {
    const result = await TaskService.createTask({
      actor: auth.actor,
      title: parsed.data.title,
      priority: parsed.data.priority,
      dueAt: parsed.data.dueAt,
      description: parsed.data.description,
      projectId: parsed.data.projectId,
    });
    if (!result.ok) {
      return toActionResult(result);
    }
    revalidateProjects(result.data.companyId, result.data.projectId);
    return toActionResult(result);
  } catch (error) {
    logServerError("tasks", error);
    return { ok: false, message: "Impossible de créer la tâche. Réessayez." };
  }
}

export async function updateTaskStatus(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }
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

  try {
    const result = await TaskService.updateTaskStatus({
      actor: auth.actor,
      taskId: parsed.data.taskId,
      status: parsed.data.status,
    });
    if (!result.ok) {
      return toActionResult(result);
    }
    revalidateProjects(result.data.companyId, result.data.projectId);
    return toActionResult(result);
  } catch (error) {
    logServerError("tasks", error);
    return { ok: false, message: "Impossible de mettre à jour la tâche. Réessayez." };
  }
}
