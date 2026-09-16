"use client";

import { useActionState, useEffect } from "react";
import { createInteraction } from "@/actions/interactions";
import { AppDialog } from "@/components/ui/app-dialog";
import { Button } from "@/components/ui/button";
import { Field, controlClassName } from "@/components/ui/field";
import { idleActionResult } from "@/lib/crm/action-result";
import { toDateTimeLocalValue } from "@/lib/crm/form-data";
import {
  INTERACTION_DIRECTION_LABELS,
  INTERACTION_RESULT_LABELS,
  INTERACTION_TYPE_LABELS,
} from "@/lib/crm/labels";
import { cn } from "@/lib/cn";

type InteractionDialogProps = {
  open: boolean;
  onClose: () => void;
  companyId: string;
};

export function InteractionDialog({
  open,
  onClose,
  companyId,
}: InteractionDialogProps) {
  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="Ajouter une interaction"
      description="L'activité sera ajoutée à la timeline, du plus récent au plus ancien."
    >
      {open ? (
        <InteractionForm companyId={companyId} onClose={onClose} />
      ) : null}
    </AppDialog>
  );
}

function InteractionForm({
  companyId,
  onClose,
}: {
  companyId: string;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    createInteraction,
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type" htmlFor="interaction-type" error={firstError("type")}>
          <select id="interaction-type" name="type" defaultValue="CALL" disabled={pending} className={controlClassName}>
            {Object.entries(INTERACTION_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Direction" htmlFor="interaction-direction" error={firstError("direction")}>
          <select
            id="interaction-direction"
            name="direction"
            defaultValue="OUTBOUND"
            disabled={pending}
            className={controlClassName}
          >
            {Object.entries(INTERACTION_DIRECTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Résultat" htmlFor="interaction-result" error={firstError("result")}>
        <select id="interaction-result" name="result" defaultValue="" disabled={pending} className={controlClassName}>
          <option value="">Non précisé</option>
          {Object.entries(INTERACTION_RESULT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Date et heure" htmlFor="interaction-occurred" error={firstError("occurredAt")}>
        <input
          id="interaction-occurred"
          name="occurredAt"
          type="datetime-local"
          required
          defaultValue={toDateTimeLocalValue(new Date())}
          disabled={pending}
          className={controlClassName}
        />
      </Field>

      <Field label="Notes" htmlFor="interaction-notes" error={firstError("notes")}>
        <textarea
          id="interaction-notes"
          name="notes"
          rows={4}
          disabled={pending}
          className={cn(controlClassName, "min-h-24 resize-y")}
        />
      </Field>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onClose} disabled={pending}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
