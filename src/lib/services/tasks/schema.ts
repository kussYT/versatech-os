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

export const PRIORITIES = ["LOW", "NORMAL", "MEDIUM", "HIGH", "URGENT"] as const;

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
export type Priority = (typeof PRIORITIES)[number];
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
