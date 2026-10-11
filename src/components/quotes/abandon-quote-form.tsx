"use client";

import { useActionState, useState } from "react";
import { abandonQuote } from "@/actions/quotes";
import { Button } from "@/components/ui/button";
import { controlClassName } from "@/components/ui/field";
import { idleActionResult, type ActionResult } from "@/lib/crm/action-result";
import { SENSITIVE_ACTION_CONFIRMS } from "@/lib/crm/confirm-sensitive-action";

type AbandonQuoteFormProps = {
  quoteId: string;
  reference: string;
  amountLabel: string;
};

export function AbandonQuoteForm(props: AbandonQuoteFormProps) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  if (!open) {
    return (
      <Button
        type="button"
        variant="danger"
        size="sm"
        className="min-h-11"
        onClick={() => {
          setFormKey((value) => value + 1);
          setOpen(true);
        }}
      >
        Clôturer sans encaissement
      </Button>
    );
  }

  return (
    <AbandonQuoteFormPanel
      key={formKey}
      {...props}
      onClose={() => setOpen(false)}
    />
  );
}

function AbandonQuoteFormPanel({
  quoteId,
  reference,
  amountLabel,
  onClose,
}: AbandonQuoteFormProps & { onClose: () => void }) {
  const [state, formAction, pending] = useActionState(abandonQuote, idleActionResult);
  const [reason, setReason] = useState("");
  const token = confirmationTokenFrom(state);

  if (state.ok) {
    return (
      <div className="w-full space-y-3 rounded-[1.25rem] border border-success/25 bg-white/60 p-4">
        <p className="text-meta text-muted" role="status">
          {state.message ?? "Devis clôturé sans encaissement."}
        </p>
        <Button type="button" variant="secondary" className="min-h-11" onClick={onClose}>
          Fermer
        </Button>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="w-full space-y-3 rounded-[1.25rem] border border-danger/25 bg-white/60 p-4"
      onSubmit={(event) => {
        if (!token) {
          return;
        }
        if (!window.confirm(SENSITIVE_ACTION_CONFIRMS.quoteAbandoned)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="quoteId" value={quoteId} />
      {token ? <input type="hidden" name="confirmationToken" value={token} /> : null}
      <p className="text-body font-medium text-foreground">
        Clôturer {reference} ({amountLabel}) sans encaissement
      </p>
      <p className="text-meta text-muted">
        Le montant sortira du prévisionnel actif. Les paiements déjà encaissés restent. Les échéances
        ouvertes seront annulées. Le devis n&apos;est pas supprimé.
      </p>
      <label className="block text-meta text-muted">
        Motif
        <textarea
          name="reason"
          required
          minLength={10}
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Ex. : le client a abandonné le projet, aucun encaissement prévu."
          className={`${controlClassName} mt-1 min-h-[5rem] resize-y`}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="danger" className="min-h-11" disabled={pending}>
          {token ? "Confirmer la clôture" : "Demander la confirmation"}
        </Button>
        <Button type="button" variant="secondary" className="min-h-11" disabled={pending} onClick={onClose}>
          Annuler
        </Button>
      </div>
      {state.message ? (
        <p className="text-meta text-danger" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function confirmationTokenFrom(state: ActionResult) {
  return typeof state.data?.confirmationToken === "string" ? state.data.confirmationToken : null;
}
