import "server-only";

import { z } from "zod";
import {
  LIST_TASKS_LIMITS,
  TASK_DUE_BUCKETS,
  taskAgentSchema,
  taskListSchema,
} from "@/lib/services/tasks/schema";

/**
 * Tool input: unknown keys (`actorId`, `now`, …) are stripped — never trusted.
 * Civil `now` is server-side (Europe/Paris). Output DTO = `TaskService.listOpenTasks`.
 */
export const listTasksInputSchema = z.object({
  dueBucket: z.enum(TASK_DUE_BUCKETS).optional(),
  projectId: z.string().min(1).optional(),
  companyId: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(LIST_TASKS_LIMITS.max).default(LIST_TASKS_LIMITS.default),
});

export const listTasksOutputSchema = taskListSchema;

export { taskAgentSchema };

export type ListTasksInput = z.infer<typeof listTasksInputSchema>;
export type ListTasksOutput = z.infer<typeof listTasksOutputSchema>;
