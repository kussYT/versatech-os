import "server-only";

import type { SessionUser } from "@/lib/auth/types";
import type { TaskDueBucket, TaskListDto } from "@/lib/services/tasks/schema";
import type { ToolRuntime } from "@/ai/context";
import { toolFailure, toolSuccess, type ToolResult } from "@/ai/result";
import type { ListTasksInput } from "@/ai/schemas/list-tasks";
import {
  COMPANY_NOT_FOUND_MESSAGE,
  isCompanyNotFoundError,
  isProjectNotFoundError,
  PROJECT_NOT_FOUND_MESSAGE,
} from "./service-errors";

export type ListTasksFn = (input: {
  actor: SessionUser;
  dueBucket?: TaskDueBucket;
  projectId?: string;
  companyId?: string;
  limit?: number;
}) => Promise<TaskListDto>;

async function defaultListTasks(input: {
  actor: SessionUser;
  dueBucket?: TaskDueBucket;
  projectId?: string;
  companyId?: string;
  limit?: number;
}): Promise<TaskListDto> {
  const { TaskService } = await import("@/lib/services/tasks");
  return TaskService.listOpenTasks({
    actor: input.actor,
    dueBucket: input.dueBucket,
    projectId: input.projectId,
    companyId: input.companyId,
    limit: input.limit,
  });
}

/**
 * READ tool: `TaskService.listOpenTasks`.
 * Does not pass model `now`. Unknown company/project → `NOT_FOUND`.
 */
export async function executeListTasks(
  runtime: ToolRuntime,
  input: ListTasksInput,
  listTasks: ListTasksFn = defaultListTasks,
): Promise<ToolResult<TaskListDto>> {
  try {
    const data = await listTasks({
      actor: runtime.actor,
      dueBucket: input.dueBucket,
      projectId: input.projectId,
      companyId: input.companyId,
      limit: input.limit,
    });
    return toolSuccess(data);
  } catch (error) {
    if (isCompanyNotFoundError(error)) {
      return toolFailure("NOT_FOUND", COMPANY_NOT_FOUND_MESSAGE);
    }
    if (isProjectNotFoundError(error)) {
      return toolFailure("NOT_FOUND", PROJECT_NOT_FOUND_MESSAGE);
    }
    return toolFailure("INTERNAL");
  }
}
