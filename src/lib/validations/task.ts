import { z } from "zod";
import { PRIORITY_LABELS, TASK_STATUSES } from "@/lib/crm/constants";
import { emptyToNull, parseDateTimeLocal } from "@/lib/crm/form-data";
import { fieldErrorsFromZod } from "@/lib/validations/company";
import { Priority } from "@/generated/prisma/client";

const PRIORITIES = Object.keys(PRIORITY_LABELS) as [Priority, ...Priority[]];

export const createTaskSchema = z.object({
  projectId: z.string().min(1, "Projet introuvable"),
  title: z.string().trim().min(1, "Le titre est obligatoire"),
  priority: z.enum(PRIORITIES, { error: "Priorité invalide" }),
  dueAt: z
    .string()
    .transform((value) => parseDateTimeLocal(value))
    .pipe(z.date().nullable()),
  description: z.string().transform((value) => emptyToNull(value)),
});

export const updateTaskStatusSchema = z.object({
  taskId: z.string().min(1, "Tâche introuvable"),
  status: z.enum(TASK_STATUSES, { error: "Statut invalide" }),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;

export { fieldErrorsFromZod };
