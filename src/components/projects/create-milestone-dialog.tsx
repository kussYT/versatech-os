"use client";

import { useActionState, useEffect } from "react";
import { createMilestone } from "@/actions/milestones";
import { AppDialog } from "@/components/ui/app-dialog";
import { Button } from "@/components/ui/button";
import { Field, controlClassName } from "@/components/ui/field";
import { idleActionResult } from "@/lib/crm/action-result";

type CreateMilestoneDialogProps = {
  open: boolean;
  onClose: () => void;
  projectId: string;
};

export function CreateMilestoneDialog({
  open,
  onClose,
  projectId,
}: CreateMilestoneDialogProps) {
  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="Créer un jalon"
      description="Les jalons restent libres — aucun modèle n'est imposé."
    >
      {open ? <CreateMilestoneForm projectId={projectId} onClose={onClose} /> : null}
    </AppDialog>
  );
}

function CreateMilestoneForm({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(createMilestone, idleActionResult);
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

      <Field label="Titre" htmlFor="milestone-name" error={firstError("name")}>
        <input
          id="milestone-name"
          name="name"
          required
          disabled={pending}
          className={controlClassName}
        />
      </Field>

      <Field label="Date" htmlFor="milestone-due" error={firstError("dueAt")}>
        <input
          id="milestone-due"
          name="dueAt"
          type="date"
          disabled={pending}
          className={controlClassName}
        />
      </Field>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onClose} disabled={pending}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Création…" : "Créer le jalon"}
        </Button>
      </div>
    </form>
  );
}
