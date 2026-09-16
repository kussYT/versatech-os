"use client";

import { useActionState, useEffect } from "react";
import { createOpportunity } from "@/actions/opportunities";
import { AppDialog } from "@/components/ui/app-dialog";
import { Button } from "@/components/ui/button";
import { Field, controlClassName } from "@/components/ui/field";
import { idleActionResult } from "@/lib/crm/action-result";
import { OPPORTUNITY_STAGE_LABELS, OPEN_OPPORTUNITY_STAGES } from "@/lib/crm/constants";

type CreateOpportunityDialogProps = {
  open: boolean;
  onClose: () => void;
  companyId: string;
};

export function CreateOpportunityDialog({
  open,
  onClose,
  companyId,
}: CreateOpportunityDialogProps) {
  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="Créer une opportunité"
      description="L'entreprise restera unique ; son cycle de vie évoluera si besoin."
    >
      {open ? <CreateOpportunityForm companyId={companyId} onClose={onClose} /> : null}
    </AppDialog>
  );
}

function CreateOpportunityForm({
  companyId,
  onClose,
}: {
  companyId: string;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    createOpportunity,
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

      <Field label="Titre" htmlFor="opportunity-title" error={firstError("title")}>
        <input
          id="opportunity-title"
          name="title"
          required
          disabled={pending}
          placeholder="Refonte site, application, maintenance…"
          className={controlClassName}
        />
      </Field>

      <Field
        label="Valeur estimée"
        htmlFor="opportunity-value"
        hint="Optionnel, en euros"
        error={firstError("estimatedValue")}
      >
        <input
          id="opportunity-value"
          name="estimatedValue"
          inputMode="decimal"
          disabled={pending}
          placeholder="0"
          className={controlClassName}
        />
      </Field>

      <Field
        label="Probabilité"
        htmlFor="opportunity-probability"
        hint="0 à 100. Vide = dérivée du stage"
        error={firstError("probability")}
      >
        <input
          id="opportunity-probability"
          name="probability"
          inputMode="numeric"
          disabled={pending}
          placeholder="Auto"
          className={controlClassName}
        />
      </Field>

      <Field label="Stage initial" htmlFor="opportunity-stage" error={firstError("stage")}>
        <select
          id="opportunity-stage"
          name="stage"
          defaultValue="TO_QUALIFY"
          disabled={pending}
          className={controlClassName}
        >
          {OPEN_OPPORTUNITY_STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {OPPORTUNITY_STAGE_LABELS[stage]}
            </option>
          ))}
        </select>
      </Field>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onClose} disabled={pending}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Création…" : "Créer l'opportunité"}
        </Button>
      </div>
    </form>
  );
}
