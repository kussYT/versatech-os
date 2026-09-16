"use client";

import { useActionState, useEffect } from "react";
import { rescheduleFollowUp } from "@/actions/follow-ups";
import { AppDialog } from "@/components/ui/app-dialog";
import { Button } from "@/components/ui/button";
import { Field, controlClassName } from "@/components/ui/field";
import { idleActionResult } from "@/lib/crm/action-result";
import { toDateTimeLocalValue } from "@/lib/crm/form-data";

type RescheduleFollowUpDialogProps = {
  open: boolean;
  onClose: () => void;
  followUpId: string;
  dueAt: string;
};

export function RescheduleFollowUpDialog({
  open,
  onClose,
  followUpId,
  dueAt,
}: RescheduleFollowUpDialogProps) {
  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="Reporter la relance"
      description="La relance existante sera mise à jour, sans en créer une nouvelle."
    >
      {open ? (
        <RescheduleForm followUpId={followUpId} dueAt={dueAt} onClose={onClose} />
      ) : null}
    </AppDialog>
  );
}

function RescheduleForm({
  followUpId,
  dueAt,
  onClose,
}: {
  followUpId: string;
  dueAt: string;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    rescheduleFollowUp,
    idleActionResult,
  );

  useEffect(() => {
    if (state.ok) {
      onClose();
    }
  }, [onClose, state]);

  const firstError = (key: string) => state.fieldErrors?.[key]?.[0];

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="followUpId" value={followUpId} />
      {state.message && !state.ok ? (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-meta text-danger" role="alert">
          {state.message}
        </p>
      ) : null}

      <Field label="Nouvelle date et heure" htmlFor={`reschedule-${followUpId}`} error={firstError("dueAt")}>
        <input
          id={`reschedule-${followUpId}`}
          name="dueAt"
          type="datetime-local"
          required
          defaultValue={toDateTimeLocalValue(new Date(dueAt))}
          disabled={pending}
          className={controlClassName}
        />
      </Field>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onClose} disabled={pending}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Reporter"}
        </Button>
      </div>
    </form>
  );
}
