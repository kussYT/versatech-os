import { SquareCheck } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PriorityBadge } from "@/components/ui/priority-badge";
import { PRIORITY_LABELS } from "@/lib/crm/constants";
import { formatDateTime } from "@/lib/crm/form-data";
import { cn } from "@/lib/cn";
import type { DashboardTaskItem } from "@/lib/queries/projects";

type TasksPanelProps = {
  tasks: DashboardTaskItem[];
};

export function TasksPanel({ tasks }: TasksPanelProps) {
  return (
    <Card className="card-aurora p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-section text-foreground">Tâches</h2>
        <Link href="/projets" className="text-meta text-primary hover:text-primary-hover">
          Voir les projets
        </Link>
      </div>
      {tasks.length === 0 ? (
        <EmptyState
          title="Aucune tâche"
          description="Les tâches ouvertes des projets apparaîtront ici."
          aside="Organisez votre productivité."
          asideIcon={SquareCheck}
        />
      ) : (
        <ul className="mt-4 space-y-2">
          {tasks.map((task) => (
            <li key={task.id}>
              <Link
                href={task.project ? `/projets/${task.project.id}` : "/projets"}
                className={cn(
                  "block rounded-lg border border-border bg-background/90 px-3 py-2",
                  "motion-safe:transition-[border-color] motion-safe:duration-hover hover:border-primary/40",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-body font-medium text-foreground">{task.title}</p>
                  <PriorityBadge
                    priority={task.priority.toLowerCase() as "low" | "normal" | "medium" | "high" | "urgent"}
                    label={PRIORITY_LABELS[task.priority]}
                  />
                </div>
                {task.project ? (
                  <p className="mt-0.5 text-meta text-muted">{task.project.name}</p>
                ) : null}
                {task.dueAt ? (
                  <p className="mt-1 font-mono text-meta text-faint">
                    {formatDateTime(task.dueAt)}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
