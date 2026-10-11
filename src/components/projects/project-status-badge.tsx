import type { MilestoneStatus, ProjectStatus, TaskStatus } from "@/generated/prisma/client";
import {
  MILESTONE_STATUS_LABELS,
  PROJECT_STATUS_LABELS,
  TASK_STATUS_LABELS,
} from "@/lib/crm/constants";
import { cn } from "@/lib/cn";

const projectStatusClassName: Record<ProjectStatus, string> = {
  PLANNED: "border-white/70 bg-white/60 text-faint",
  ACTIVE: "border-primary/30 bg-primary/10 text-primary",
  WAITING_CLIENT: "border-warning/30 bg-warning/10 text-amber-700",
  REVIEW: "border-cyan/30 bg-cyan/10 text-sky-700",
  COMPLETED: "border-success/30 bg-success/10 text-emerald-700",
  ARCHIVED: "border-white/70 bg-white/60 text-muted",
};

const taskStatusClassName: Record<TaskStatus, string> = {
  TODO: "border-white/70 bg-white/60 text-faint",
  IN_PROGRESS: "border-primary/30 bg-primary/10 text-primary",
  DONE: "border-success/30 bg-success/10 text-emerald-700",
  CANCELED: "border-danger/30 bg-danger/10 text-red-600",
};

const milestoneStatusClassName: Record<MilestoneStatus, string> = {
  PENDING: "border-warning/30 bg-warning/10 text-amber-700",
  DONE: "border-success/30 bg-success/10 text-emerald-700",
  CANCELED: "border-danger/30 bg-danger/10 text-red-600",
};

function Badge({ className, label }: { className: string; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-badge backdrop-blur-sm font-semibold tracking-wide uppercase",
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </span>
  );
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge className={projectStatusClassName[status]} label={PROJECT_STATUS_LABELS[status]} />;
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge className={taskStatusClassName[status]} label={TASK_STATUS_LABELS[status]} />;
}

export function MilestoneStatusBadge({ status }: { status: MilestoneStatus }) {
  return (
    <Badge className={milestoneStatusClassName[status]} label={MILESTONE_STATUS_LABELS[status]} />
  );
}
