import Link from "next/link";
import { TaskStatusActions } from "@/components/projects/task-status-actions";
import { TaskStatusBadge } from "@/components/projects/project-status-badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PriorityBadge } from "@/components/ui/priority-badge";
import { PRIORITY_LABELS } from "@/lib/crm/constants";
import { formatDateTime } from "@/lib/crm/form-data";
import { dueBucket } from "@/lib/dates";
import type { TaskListItem } from "@/lib/queries/projects";

type TaskBucket = "overdue" | "today" | "upcoming" | "undated";

const SECTIONS: { bucket: TaskBucket; title: string; empty: string }[] = [
  { bucket: "overdue", title: "En retard", empty: "Aucune tâche en retard." },
  { bucket: "today", title: "Aujourd'hui", empty: "Aucune tâche prévue aujourd'hui." },
  { bucket: "upcoming", title: "À venir", empty: "Aucune tâche à venir." },
  { bucket: "undated", title: "Sans échéance", empty: "Aucune tâche sans date." },
];

function bucketFor(task: TaskListItem): TaskBucket {
  if (!task.dueAt) {
    return "undated";
  }

  return dueBucket(new Date(task.dueAt));
}

type TaskBoardProps = {
  tasks: TaskListItem[];
};

export function TaskBoard({ tasks }: TaskBoardProps) {
  const board: Record<TaskBucket, TaskListItem[]> = {
    overdue: [],
    today: [],
    upcoming: [],
    undated: [],
  };

  for (const task of tasks) {
    board[bucketFor(task)].push(task);
  }

  if (tasks.length === 0) {
    return (
      <Card className="px-5">
        <EmptyState
          title="Aucune tâche ouverte"
          description="Créez des tâches depuis la fiche d'un projet."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {SECTIONS.map((section) => {
        const items = board[section.bucket];
        return (
          <Card key={section.bucket} className="p-4 sm:p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-section text-foreground">{section.title}</h2>
              <p className="text-meta tabular-nums text-muted">{items.length}</p>
            </div>
            {items.length === 0 ? (
              <EmptyState title={section.empty} />
            ) : (
              <ul className="mt-4 space-y-2">
                {items.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </ul>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function TaskRow({ task }: { task: TaskListItem }) {
  const href = task.project ? `/projets/${task.project.id}` : "/projets";

  return (
    <li className="rounded-xl border border-border bg-background/60 px-4 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={href} className="text-body font-medium text-foreground hover:text-primary">
              {task.title}
            </Link>
            <TaskStatusBadge status={task.status} />
            <PriorityBadge
              priority={task.priority.toLowerCase() as "low" | "normal" | "medium" | "high" | "urgent"}
              label={PRIORITY_LABELS[task.priority]}
            />
          </div>
          <p className="mt-1 text-meta text-muted">
            {task.project?.name ?? "Sans projet"}
            {task.company ? ` · ${task.company.name}` : ""}
          </p>
          {task.dueAt ? (
            <p className="mt-1 font-mono text-meta text-faint">{formatDateTime(task.dueAt)}</p>
          ) : null}
        </div>
        <TaskStatusActions taskId={task.id} status={task.status} />
      </div>
    </li>
  );
}
