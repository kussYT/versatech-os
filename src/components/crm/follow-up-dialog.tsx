"use client";

import { useActionState, useEffect } from "react";
import { createFollowUp } from "@/actions/follow-ups";
import { AppDialog } from "@/components/ui/app-dialog";
import { Button } from "@/components/ui/button";
import { Field, controlClassName } from "@/components/ui/field";
import { idleActionResult } from "@/lib/crm/action-result";
import { defaultFollowUpDueAt, toDateTimeLocalValue } from "@/lib/crm/form-data";
import { cn } from "@/lib/cn";

type FollowUpDialogProps = {
  open: boolean;
  onClose: () => void;
  companyId: string;
};

export function FollowUpDialog({ open, onClose, companyId }: FollowUpDialogProps) {
  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="Planifier une relance"
      description="La relance restera en attente jusqu'à son traitement."
    >
      {open ? <FollowUpForm companyId={companyId} onClose={onClose} /> : null}
    </AppDialog>
  );
}

function FollowUpForm({
  companyId,
  onClose,
}: {
  companyId: string;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    createFollowUp,
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
      <input type="hidden" name="companyId" value={companyId} />
      {state.message && !state.ok ? (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-meta text-danger" role="alert">
          {state.message}
        </p>
      ) : null}

      <Field label="Date et heure" htmlFor="followup-due" error={firstError("dueAt")}>
        <input
          id="followup-due"
          name="dueAt"
          type="datetime-local"
          required
          defaultValue={toDateTimeLocalValue(defaultFollowUpDueAt())}
          disabled={pending}
          className={controlClassName}
        />
      </Field>

      <Field label="Note" htmlFor="followup-note" error={firstError("note")}>
        <textarea
          id="followup-note"
          name="note"
          rows={3}
          placeholder="Relance"
          disabled={pending}
          className={cn(controlClassName, "min-h-24 resize-y")}
        />
      </Field>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onClose} disabled={pending}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Planification…" : "Planifier"}
        </Button>
      </div>
    </form>
  );
}
