import "server-only";

import type { SessionUser } from "@/lib/auth/types";
import { endOfToday, startOfToday } from "@/lib/dates";
import { loadCompanyExists } from "@/lib/queries/companies";
import { loadOpenTasks, loadProjectExists, type LoadOpenTasksInput } from "@/lib/queries/projects";
import { mapTaskList } from "./map";
import { createTask, updateTaskStatus } from "./write";
import {
  COMPANY_NOT_FOUND_MESSAGE,
  PROJECT_NOT_FOUND_MESSAGE,
  parseListOpenTasksInput,
  requireServiceActor,
  type TaskDueBucket,
  type TaskListDto,
} from "./schema";

export { COMPANY_NOT_FOUND_MESSAGE, PROJECT_NOT_FOUND_MESSAGE };

export type ListOpenTasksInput = {
  actor: SessionUser;
  dueBucket?: TaskDueBucket;
  projectId?: string;
  companyId?: string;
  limit?: number;
  now?: Date;
};

function dueAtFilter(bucket: TaskDueBucket | undefined, now: Date): Pick<
  LoadOpenTasksInput,
  "dueAt" | "includeNullDueAt"
> {
  if (!bucket) {
    return {};
  }

  const start = startOfToday(now);
  const end = endOfToday(now);

  if (bucket === "overdue") {
    return { dueAt: { lt: start } };
  }
  if (bucket === "today") {
    return { dueAt: { gte: start, lte: end } };
  }
  return { dueAt: { gt: end }, includeNullDueAt: true };
}

/**
 * Tâches ouvertes (TODO | IN_PROGRESS), filtrables par échéance Paris, projet, entreprise.
 * SQL `take` — pas un dump UI. READ only — no redirect, no ActivityLog.
 */
export async function listOpenTasks({
  actor,
  dueBucket,
  projectId,
  companyId,
  limit,
  now = new Date(),
}: ListOpenTasksInput): Promise<TaskListDto> {
  requireServiceActor(actor);
  const input = parseListOpenTasksInput({ dueBucket, projectId, companyId, limit });

  if (input.companyId) {
    const exists = await loadCompanyExists(input.companyId);
    if (!exists) {
      throw new Error(COMPANY_NOT_FOUND_MESSAGE);
    }
  }

  if (input.projectId) {
    const exists = await loadProjectExists(input.projectId);
    if (!exists) {
      throw new Error(PROJECT_NOT_FOUND_MESSAGE);
    }
  }

  const items = await loadOpenTasks({
    take: input.limit,
    companyId: input.companyId,
    projectId: input.projectId,
    ...dueAtFilter(input.dueBucket, now),
  });

  return mapTaskList(items, input.limit);
}

export { createTask, updateTaskStatus };
export type {
  CreateTaskInput,
  UpdateTaskStatusInput,
  TaskWriteResult,
} from "./write";

export const TaskService = {
  listOpenTasks,
  createTask,
  updateTaskStatus,
};
