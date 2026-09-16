"use client";

import { useActionState, useEffect } from "react";
import { createQuote } from "@/actions/quotes";
import { AppDialog } from "@/components/ui/app-dialog";
import { Button } from "@/components/ui/button";
import { Field, controlClassName } from "@/components/ui/field";
import { idleActionResult } from "@/lib/crm/action-result";

type QuoteOpportunityOption = {
  id: string;
  title: string;
};

type CreateQuoteDialogProps = {
  open: boolean;
  onClose: () => void;
  companyId: string;
  opportunities: QuoteOpportunityOption[];
};

export function CreateQuoteDialog({
  open,
  onClose,
  companyId,
  opportunities,
}: CreateQuoteDialogProps) {
  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="Créer un devis"
      description="Suivi commercial uniquement — pas de PDF ni de facturation."
    >
      {open ? (
        <CreateQuoteForm
          companyId={companyId}
          opportunities={opportunities}
          onClose={onClose}
        />
      ) : null}
    </AppDialog>
  );
}

function CreateQuoteForm({
  companyId,
  opportunities,
  onClose,
}: {
  companyId: string;
  opportunities: QuoteOpportunityOption[];
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(createQuote, idleActionResult);
  const firstError = (key: string) => state.fieldErrors?.[key]?.[0];

  useEffect(() => {
    if (state.ok) {
      onClose();
    }
  }, [onClose, state]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="companyId" value={companyId} />
      {state.message && !state.ok ? (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-meta text-danger" role="alert">
          {state.message}
        </p>
      ) : null}

      <Field label="Opportunité" htmlFor="quote-opportunity" error={firstError("opportunityId")}>
        <select
          id="quote-opportunity"
          name="opportunityId"
          required
          disabled={pending}
          defaultValue={opportunities[0]?.id ?? ""}
          className={controlClassName}
        >
          {opportunities.map((opportunity) => (
            <option key={opportunity.id} value={opportunity.id}>
              {opportunity.title}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Montant TTC"
        htmlFor="quote-amount"
        hint="En euros"
        error={firstError("amountIncTax")}
      >
        <input
          id="quote-amount"
          name="amountIncTax"
          inputMode="decimal"
          required
          disabled={pending}
          placeholder="3200"
          className={controlClassName}
        />
      </Field>

      <Field
        label="Référence"
        htmlFor="quote-reference"
        hint="Optionnel — générée automatiquement si vide"
        error={firstError("reference")}
      >
        <input
          id="quote-reference"
          name="reference"
          disabled={pending}
          placeholder="DEV-2026-002"
          className={controlClassName}
        />
      </Field>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onClose} disabled={pending}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Création…" : "Créer le devis"}
        </Button>
      </div>
    </form>
  );
}
