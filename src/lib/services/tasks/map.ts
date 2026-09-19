import "server-only";

import type { TaskListItem } from "@/lib/queries/projects";
import { clampCollection, parseTaskList, type TaskAgentDto, type TaskListDto } from "./schema";

export function mapTaskAgent(item: TaskListItem): TaskAgentDto {
  if (item.status !== "TODO" && item.status !== "IN_PROGRESS") {
    throw new Error("Statut de tâche inattendu.");
  }

  return {
    id: item.id,
    title: item.title,
    dueAt: item.dueAt,
    priority: item.priority,
    status: item.status,
    project: item.project,
    company: item.company,
  };
}

export function mapTaskList(items: readonly TaskListItem[], limit: number): TaskListDto {
  const mapped = clampCollection(items.map(mapTaskAgent), limit);
  return parseTaskList({
    items: mapped,
    returned: mapped.length,
    limit,
  });
}
