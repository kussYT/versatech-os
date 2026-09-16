"use client";

import { useActionState, useEffect } from "react";
import { createTask } from "@/actions/tasks";
import { AppDialog } from "@/components/ui/app-dialog";
import { Button } from "@/components/ui/button";
import { Field, controlClassName } from "@/components/ui/field";
import { idleActionResult } from "@/lib/crm/action-result";
import { PRIORITY_LABELS } from "@/lib/crm/constants";
import type { Priority } from "@/generated/prisma/client";

type CreateTaskDialogProps = {
  open: boolean;
  onClose: () => void;
  projectId: string;
};

export function CreateTaskDialog({ open, onClose, projectId }: CreateTaskDialogProps) {
  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="Créer une tâche"
      description="Suivi de production — liste simple, sans Kanban."
    >
      {open ? <CreateTaskForm projectId={projectId} onClose={onClose} /> : null}
    </AppDialog>
  );
}

function CreateTaskForm({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(createTask, idleActionResult);
  const firstError = (key: string) => state.fieldErrors?.[key]?.[0];

  useEffect(() => {
    if (state.ok) {
      onClose();
    }
  }, [onClose, state]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="projectId" value={projectId} />
      {state.message && !state.ok ? (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-meta text-danger" role="alert">
          {state.message}
        </p>
      ) : null}

      <Field label="Titre" htmlFor="task-title" error={firstError("title")}>
        <input id="task-title" name="title" required disabled={pending} className={controlClassName} />
      </Field>

      <Field label="Priorité" htmlFor="task-priority" error={firstError("priority")}>
        <select
          id="task-priority"
          name="priority"
          disabled={pending}
          defaultValue="NORMAL"
          className={controlClassName}
        >
          {(Object.keys(PRIORITY_LABELS) as Priority[]).map((priority) => (
            <option key={priority} value={priority}>
              {PRIORITY_LABELS[priority]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Échéance" htmlFor="task-due" error={firstError("dueAt")}>
        <input
          id="task-due"
          name="dueAt"
          type="datetime-local"
          disabled={pending}
          className={controlClassName}
        />
      </Field>

      <Field label="Description" htmlFor="task-description" error={firstError("description")}>
        <textarea
          id="task-description"
          name="description"
          rows={3}
          disabled={pending}
          className={controlClassName}
        />
      </Field>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onClose} disabled={pending}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Création…" : "Créer la tâche"}
        </Button>
      </div>
    </form>
  );
}
