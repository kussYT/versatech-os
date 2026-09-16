"use client";

import { useActionState } from "react";
import { updateProjectStatus } from "@/actions/projects";
import { Button } from "@/components/ui/button";
import { idleActionResult } from "@/lib/crm/action-result";
import type { ProjectStatus } from "@/generated/prisma/client";

const ACTIONS: {
  from: ProjectStatus[];
  to: ProjectStatus;
  label: string;
  variant?: "primary" | "secondary" | "danger";
}[] = [
  { from: ["PLANNED"], to: "ACTIVE", label: "Démarrer" },
  { from: ["ACTIVE"], to: "WAITING_CLIENT", label: "Attente client", variant: "secondary" },
  { from: ["ACTIVE", "WAITING_CLIENT"], to: "REVIEW", label: "Passer en recette" },
  { from: ["WAITING_CLIENT", "REVIEW"], to: "ACTIVE", label: "Reprendre", variant: "secondary" },
  { from: ["ACTIVE", "REVIEW"], to: "COMPLETED", label: "Terminer" },
  { from: ["COMPLETED"], to: "ARCHIVED", label: "Archiver", variant: "secondary" },
];

type ProjectStatusActionsProps = {
  projectId: string;
  status: ProjectStatus;
};

export function ProjectStatusActions({ projectId, status }: ProjectStatusActionsProps) {
  const [state, formAction, pending] = useActionState(updateProjectStatus, idleActionResult);
  const actions = ACTIONS.filter((action) => action.from.includes(status));

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <form key={action.to} action={formAction}>
          <input type="hidden" name="projectId" value={projectId} />
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
