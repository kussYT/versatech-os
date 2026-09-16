"use client";

import { useActionState, useEffect } from "react";
import { createProject } from "@/actions/projects";
import { AppDialog } from "@/components/ui/app-dialog";
import { Button } from "@/components/ui/button";
import { Field, controlClassName } from "@/components/ui/field";
import { idleActionResult } from "@/lib/crm/action-result";
import { PROJECT_STATUS_LABELS, PROJECT_STATUSES } from "@/lib/crm/constants";
import { formatMoney } from "@/lib/crm/form-data";

type AcceptedQuoteOption = {
  id: string;
  reference: string;
  amountIncTax: string;
};

type CreateProjectDialogProps = {
  open: boolean;
  onClose: () => void;
  companyId: string;
  quotes: AcceptedQuoteOption[];
};

export function CreateProjectDialog({
  open,
  onClose,
  companyId,
  quotes,
}: CreateProjectDialogProps) {
  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="Créer un projet"
      description="Suivi de production — le devis accepté peut être associé s'il existe."
    >
      {open ? (
        <CreateProjectForm companyId={companyId} quotes={quotes} onClose={onClose} />
      ) : null}
    </AppDialog>
  );
}

function CreateProjectForm({
  companyId,
  quotes,
  onClose,
}: {
  companyId: string;
  quotes: AcceptedQuoteOption[];
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(createProject, idleActionResult);
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

      <Field label="Nom" htmlFor="project-name" error={firstError("name")}>
        <input
          id="project-name"
          name="name"
          required
          disabled={pending}
          className={controlClassName}
        />
      </Field>

      <Field label="Statut" htmlFor="project-status" error={firstError("status")}>
        <select
          id="project-status"
          name="status"
          required
          disabled={pending}
          defaultValue="PLANNED"
          className={controlClassName}
        >
          {PROJECT_STATUSES.filter((status) => status !== "ARCHIVED").map((status) => (
            <option key={status} value={status}>
              {PROJECT_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date de début" htmlFor="project-start" error={firstError("startDate")}>
          <input
            id="project-start"
            name="startDate"
            type="date"
            disabled={pending}
            className={controlClassName}
          />
        </Field>
        <Field label="Deadline" htmlFor="project-due" error={firstError("dueDate")}>
          <input
            id="project-due"
            name="dueDate"
            type="date"
            disabled={pending}
            className={controlClassName}
          />
        </Field>
      </div>

      <Field
        label="Montant"
        htmlFor="project-amount"
        hint="Optionnel, en euros"
        error={firstError("amount")}
      >
        <input
          id="project-amount"
          name="amount"
          inputMode="decimal"
          disabled={pending}
          placeholder="14500"
          className={controlClassName}
        />
      </Field>

      {quotes.length > 0 ? (
        <Field
          label="Devis accepté"
          htmlFor="project-quote"
          hint="Optionnel"
          error={firstError("quoteId")}
        >
          <select
            id="project-quote"
            name="quoteId"
            disabled={pending}
            defaultValue=""
            className={controlClassName}
          >
            <option value="">Aucun</option>
            {quotes.map((quote) => (
              <option key={quote.id} value={quote.id}>
                {quote.reference} · {formatMoney(quote.amountIncTax)}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      <Field label="Description" htmlFor="project-description" error={firstError("description")}>
        <textarea
          id="project-description"
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
          {pending ? "Création…" : "Créer le projet"}
        </Button>
      </div>
    </form>
  );
}
