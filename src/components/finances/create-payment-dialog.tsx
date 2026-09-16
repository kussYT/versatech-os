"use client";

import { useActionState, useEffect } from "react";
import { createPayment } from "@/actions/payments";
import { PaymentFields } from "@/components/finances/payment-fields";
import { AppDialog } from "@/components/ui/app-dialog";
import { Button } from "@/components/ui/button";
import { idleActionResult } from "@/lib/crm/action-result";
import type { PaymentFormOptions } from "@/lib/queries/payments";

type CreatePaymentDialogProps = {
  open: boolean;
  onClose: () => void;
  options: PaymentFormOptions;
  defaultCompanyId?: string;
  defaultProjectId?: string;
  defaultQuoteId?: string;
};

export function CreatePaymentDialog({
  open,
  onClose,
  options,
  defaultCompanyId,
  defaultProjectId,
  defaultQuoteId,
}: CreatePaymentDialogProps) {
  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="Enregistrer un paiement"
      description="Suivi d'encaissement — pas de Shine, Stripe ni de comptabilité."
    >
      {open ? (
        <CreatePaymentForm
          options={options}
          defaultCompanyId={defaultCompanyId}
          defaultProjectId={defaultProjectId}
          defaultQuoteId={defaultQuoteId}
          onClose={onClose}
        />
      ) : null}
    </AppDialog>
  );
}

function CreatePaymentForm({
  options,
  defaultCompanyId,
  defaultProjectId,
  defaultQuoteId,
  onClose,
}: {
  options: PaymentFormOptions;
  defaultCompanyId?: string;
  defaultProjectId?: string;
  defaultQuoteId?: string;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(createPayment, idleActionResult);
  const firstError = (key: string) => state.fieldErrors?.[key]?.[0];

  useEffect(() => {
    if (state.ok) {
      onClose();
    }
  }, [onClose, state]);

  return (
    <form action={formAction} className="space-y-4">
      {state.message && !state.ok ? (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-meta text-danger" role="alert">
          {state.message}
        </p>
      ) : null}

      <PaymentFields
        pending={pending}
        firstError={firstError}
        options={options}
        defaultCompanyId={defaultCompanyId}
        defaultProjectId={defaultProjectId}
        defaultQuoteId={defaultQuoteId}
        lockCompany={Boolean(defaultCompanyId)}
        lockProject={Boolean(defaultProjectId)}
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onClose} disabled={pending}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer le paiement"}
        </Button>
      </div>
    </form>
  );
}
