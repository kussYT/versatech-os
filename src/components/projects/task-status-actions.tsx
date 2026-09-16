"use client";

import { useActionState } from "react";
import { updateTaskStatus } from "@/actions/tasks";
import { Button } from "@/components/ui/button";
import { idleActionResult } from "@/lib/crm/action-result";
import type { TaskStatus } from "@/generated/prisma/client";

const ACTIONS: {
  from: TaskStatus[];
  to: TaskStatus;
  label: string;
  variant?: "primary" | "secondary" | "danger";
}[] = [
  { from: ["TODO"], to: "IN_PROGRESS", label: "Démarrer" },
  { from: ["IN_PROGRESS"], to: "DONE", label: "Terminer" },
  { from: ["IN_PROGRESS"], to: "TODO", label: "Remettre à faire", variant: "secondary" },
  { from: ["TODO", "IN_PROGRESS"], to: "CANCELED", label: "Annuler", variant: "danger" },
];

type TaskStatusActionsProps = {
  taskId: string;
  status: TaskStatus;
};

export function TaskStatusActions({ taskId, status }: TaskStatusActionsProps) {
  const [state, formAction, pending] = useActionState(updateTaskStatus, idleActionResult);
  const actions = ACTIONS.filter((action) => action.from.includes(status));

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <form key={action.to} action={formAction}>
          <input type="hidden" name="taskId" value={taskId} />
          <input type="hidden" name="status" value={action.to} />
          <Button type="submit" size="sm" variant={action.variant} disabled={pending}>
            {action.label}
          </Button>
        </form>
      ))}
      {state.message && !state.ok ? (
        <p className="w-full text-meta text-danger" role="alert">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
