import type { MilestoneStatus, ProjectStatus, TaskStatus } from "@/generated/prisma/client";
import {
  MILESTONE_STATUS_LABELS,
  PROJECT_STATUS_LABELS,
  TASK_STATUS_LABELS,
} from "@/lib/crm/constants";
import { cn } from "@/lib/cn";

const projectStatusClassName: Record<ProjectStatus, string> = {
  PLANNED: "border-faint/40 bg-surface-high text-faint",
  ACTIVE: "border-primary/30 bg-primary/10 text-primary",
  WAITING_CLIENT: "border-warning/30 bg-warning/10 text-warning",
  REVIEW: "border-cyan/30 bg-cyan/10 text-cyan",
  COMPLETED: "border-success/30 bg-success/10 text-success",
  ARCHIVED: "border-faint/40 bg-surface-high text-muted",
};

const taskStatusClassName: Record<TaskStatus, string> = {
  TODO: "border-faint/40 bg-surface-high text-faint",
  IN_PROGRESS: "border-primary/30 bg-primary/10 text-primary",
  DONE: "border-success/30 bg-success/10 text-success",
  CANCELED: "border-danger/30 bg-danger/10 text-danger",
};

const milestoneStatusClassName: Record<MilestoneStatus, string> = {
  PENDING: "border-warning/30 bg-warning/10 text-warning",
  DONE: "border-success/30 bg-success/10 text-success",
  CANCELED: "border-danger/30 bg-danger/10 text-danger",
};

function Badge({ className, label }: { className: string; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-badge font-semibold tracking-wide uppercase",
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
