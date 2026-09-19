/**
 * Task READ DTOs — open tasks only (TODO | IN_PROGRESS).
 * Pas de Prisma, pas de `href`, pas de `description` (texte libre) en liste V1.
 */
import { z } from "zod";

export const LIST_TASKS_LIMITS = {
  default: 15,
  max: 30,
} as const;

export const TASK_DUE_BUCKETS = ["overdue", "today", "upcoming"] as const;

export const OPEN_TASK_STATUSES = ["TODO", "IN_PROGRESS"] as const;

export const TASK_WRITE_STATUSES = ["TODO", "IN_PROGRESS", "DONE", "CANCELED"] as const;

export const PRIORITIES = ["LOW", "NORMAL", "MEDIUM", "HIGH", "URGENT"] as const;

export const COMPANY_NOT_FOUND_MESSAGE = "Entreprise introuvable.";
export const PROJECT_NOT_FOUND_MESSAGE = "Projet introuvable.";
export const TASK_NOT_FOUND_MESSAGE = "Tâche introuvable.";
export const TASK_ANCHOR_REQUIRED_MESSAGE = "Rattachez la tâche à une entreprise ou un projet.";
export const TASK_PROJECT_COMPANY_MISMATCH_MESSAGE =
  "Ce projet n'appartient pas à cette entreprise.";
export const TASK_TRANSITION_NOT_ALLOWED_MESSAGE = "Cette transition n'est pas autorisée.";
export const TASK_CREATE_VALIDATION_MESSAGE = "Vérifiez les champs du formulaire.";
export const TASK_STATUS_VALIDATION_MESSAGE = "Statut de tâche invalide.";

const optionalPersistedId = z.string().min(1).nullable().optional();

/** Object contract (Date / enums) — not FormData strings. */
export const createTaskInputSchema = z
  .strictObject({
    title: z.string().trim().min(1, "Le titre est obligatoire"),
    priority: z.enum(PRIORITIES).default("NORMAL"),
    dueAt: z.date().nullable().optional(),
    description: z.string().nullable().optional(),
    projectId: optionalPersistedId,
    companyId: optionalPersistedId,
  })
  .superRefine((value, ctx) => {
    const hasProject = typeof value.projectId === "string" && value.projectId.length > 0;
    const hasCompany = typeof value.companyId === "string" && value.companyId.length > 0;
    if (!hasProject && !hasCompany) {
      ctx.addIssue({
        code: "custom",
        message: TASK_ANCHOR_REQUIRED_MESSAGE,
        path: ["companyId"],
      });
      ctx.addIssue({
        code: "custom",
        message: TASK_ANCHOR_REQUIRED_MESSAGE,
        path: ["projectId"],
      });
    }
  });

export const updateTaskStatusInputSchema = z.strictObject({
  taskId: z.string().min(1, "Tâche introuvable"),
  status: z.enum(TASK_WRITE_STATUSES, { error: "Statut invalide" }),
});

const ISO_INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

export const isoDateTimeStringSchema = z.string().refine((value) => {
  if (!ISO_INSTANT_RE.test(value)) {
    return false;
  }
  return !Number.isNaN(Date.parse(value));
}, "Date ISO 8601 invalide (attendu Date.toISOString())");

const namedEntitySchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
});

export const listOpenTasksInputSchema = z.strictObject({
  dueBucket: z.enum(TASK_DUE_BUCKETS).optional(),
  projectId: z.string().min(1).optional(),
  companyId: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(LIST_TASKS_LIMITS.max).default(LIST_TASKS_LIMITS.default),
});

export const taskAgentSchema = z.strictObject({
  id: z.string().min(1),
  title: z.string().min(1),
  dueAt: isoDateTimeStringSchema.nullable(),
  priority: z.enum(PRIORITIES),
  status: z.enum(OPEN_TASK_STATUSES),
  project: namedEntitySchema.nullable(),
  company: namedEntitySchema.nullable(),
});

export const taskListSchema = z
  .strictObject({
    items: z.array(taskAgentSchema).max(LIST_TASKS_LIMITS.max),
    returned: z.number().int().min(0),
    limit: z.number().int().min(1).max(LIST_TASKS_LIMITS.max),
  })
  .superRefine((value, ctx) => {
    if (value.returned !== value.items.length) {
      ctx.addIssue({
        code: "custom",
        message: "returned doit égaler items.length.",
        path: ["returned"],
      });
    }
    if (value.returned > value.limit) {
      ctx.addIssue({
        code: "custom",
        message: "returned ne peut pas dépasser limit.",
        path: ["returned"],
      });
    }
  });

export type TaskDueBucket = (typeof TASK_DUE_BUCKETS)[number];
export type OpenTaskStatus = (typeof OPEN_TASK_STATUSES)[number];
export type TaskWriteStatus = (typeof TASK_WRITE_STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type CreateTaskParsed = z.output<typeof createTaskInputSchema>;
export type UpdateTaskStatusParsed = z.output<typeof updateTaskStatusInputSchema>;
export type TaskAgentDto = z.infer<typeof taskAgentSchema>;
export type TaskListDto = z.infer<typeof taskListSchema>;
export type ListOpenTasksParsed = z.output<typeof listOpenTasksInputSchema>;

/** Services throw this before any Prisma load. Never redirect. */
export function requireServiceActor(actor: { id?: string } | null | undefined) {
  if (!actor?.id) {
    throw new Error("Acteur requis.");
  }
}

export function emptyTaskList(limit = LIST_TASKS_LIMITS.default): TaskListDto {
  return parseTaskList({
    items: [],
    returned: 0,
    limit,
  });
}

export function clampCollection<T>(items: readonly T[], limit: number): T[] {
  return items.slice(0, limit);
}

export function parseListOpenTasksInput(input: unknown): ListOpenTasksParsed {
  return listOpenTasksInputSchema.parse(input);
}

export function parseCreateTaskInput(input: unknown): CreateTaskParsed {
  return createTaskInputSchema.parse(input);
}

export function parseUpdateTaskStatusInput(input: unknown): UpdateTaskStatusParsed {
  return updateTaskStatusInputSchema.parse(input);
}

export function parseTaskList(input: unknown): TaskListDto {
  return taskListSchema.parse(input);
}

export function serializeTaskList(input: unknown): string {
  return JSON.stringify(parseTaskList(input));
}

export function isPlainJsonValue(value: unknown): boolean {
  if (value === null) {
    return true;
  }

  const valueType = typeof value;
  if (valueType === "string" || valueType === "boolean") {
    return true;
  }
  if (valueType === "number") {
    return Number.isFinite(value);
  }
  if (valueType !== "object") {
    return false;
  }

  if (Array.isArray(value)) {
    return value.every(isPlainJsonValue);
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return false;
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    return false;
  }

  return Object.values(value as Record<string, unknown>).every(isPlainJsonValue);
}
