"use client";

import { useActionState, useEffect } from "react";
import { updateCompany } from "@/actions/companies";
import { AppDialog } from "@/components/ui/app-dialog";
import { Button } from "@/components/ui/button";
import { Field, controlClassName } from "@/components/ui/field";
import { idleActionResult } from "@/lib/crm/action-result";
import {
  COMPANY_LIFECYCLE_LABELS,
  PRIORITY_LABELS,
} from "@/lib/crm/constants";
import type { CompanyDetail } from "@/lib/queries/companies";
import { cn } from "@/lib/cn";

type EditCompanyDialogProps = {
  open: boolean;
  onClose: () => void;
  company: CompanyDetail;
};

export function EditCompanyDialog({
  open,
  onClose,
  company,
}: EditCompanyDialogProps) {
  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="Modifier l'entreprise"
      description="Les informations principales et le contact principal."
    >
      {open ? <EditCompanyForm company={company} onClose={onClose} /> : null}
    </AppDialog>
  );
}

function EditCompanyForm({
  company,
  onClose,
}: {
  company: CompanyDetail;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    updateCompany,
    idleActionResult,
  );
  const contact = company.contacts[0];
  const firstError = (key: string) => state.fieldErrors?.[key]?.[0];

  useEffect(() => {
    if (state.ok) {
      onClose();
    }
  }, [onClose, state]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={company.id} />
      {state.message && !state.ok ? (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-meta text-danger" role="alert">
          {state.message}
        </p>
      ) : null}

      <Field label="Nom de l'entreprise" htmlFor="edit-name" error={firstError("name")}>
        <input
          id="edit-name"
          name="name"
          required
          defaultValue={company.name}
          disabled={pending}
          className={controlClassName}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Statut"
          htmlFor="edit-lifecycle"
          error={firstError("lifecycleStatus")}
          hint={
            company.lifecycleStatus === "CLIENT" &&
            company.allowedLifecycleStatuses.length <= 2
              ? "Client justifié (WON, devis accepté ou projet). Seul le passage en inactif est manuel."
              : "Le statut Client n'est pas saisissable sans opportunité gagnée, devis accepté ou projet."
          }
        >
          <select
            id="edit-lifecycle"
            name="lifecycleStatus"
            defaultValue={company.lifecycleStatus}
            disabled={pending}
            className={controlClassName}
          >
            {company.allowedLifecycleStatuses.map((value) => (
              <option key={value} value={value}>
                {COMPANY_LIFECYCLE_LABELS[value]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Priorité" htmlFor="edit-priority" error={firstError("priority")}>
          <select
            id="edit-priority"
            name="priority"
            defaultValue={company.priority}
            disabled={pending}
            className={controlClassName}
          >
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Secteur" htmlFor="edit-industry">
          <input id="edit-industry" name="industry" defaultValue={company.industry ?? ""} disabled={pending} className={controlClassName} />
        </Field>
        <Field label="Ville" htmlFor="edit-city">
          <input id="edit-city" name="city" defaultValue={company.city ?? ""} disabled={pending} className={controlClassName} />
        </Field>
      </div>

      <Field label="Adresse" htmlFor="edit-address" error={firstError("address")}>
        <input
          id="edit-address"
          name="address"
          required
          defaultValue={company.address ?? ""}
          disabled={pending}
          className={controlClassName}
        />
      </Field>
      <Field label="Code postal" htmlFor="edit-postal">
        <input
          id="edit-postal"
          name="postalCode"
          defaultValue={company.postalCode ?? ""}
          disabled={pending}
          className={controlClassName}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Téléphone" htmlFor="edit-phone">
          <input id="edit-phone" name="phone" type="tel" defaultValue={company.phone ?? ""} disabled={pending} className={controlClassName} />
        </Field>
        <Field label="E-mail" htmlFor="edit-email" error={firstError("email")}>
          <input id="edit-email" name="email" type="email" defaultValue={company.email ?? ""} disabled={pending} className={controlClassName} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Site internet" htmlFor="edit-website" error={firstError("website")}>
          <input id="edit-website" name="website" defaultValue={company.website ?? ""} disabled={pending} className={controlClassName} />
        </Field>
        <Field label="Source" htmlFor="edit-source">
          <input id="edit-source" name="source" defaultValue={company.source ?? ""} disabled={pending} className={controlClassName} />
        </Field>
      </div>

      <Field label="Notes" htmlFor="edit-notes">
        <textarea
          id="edit-notes"
          name="description"
          rows={3}
          defaultValue={company.description ?? ""}
          disabled={pending}
          className={cn(controlClassName, "min-h-24 resize-y")}
        />
      </Field>

      <p className="text-meta font-medium tracking-[0.08em] text-muted uppercase">
        Contact principal
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prénom" htmlFor="edit-contact-first" error={firstError("contactFirstName")}>
          <input id="edit-contact-first" name="contactFirstName" defaultValue={contact?.firstName ?? ""} disabled={pending} className={controlClassName} />
        </Field>
        <Field label="Nom" htmlFor="edit-contact-last" error={firstError("contactLastName")}>
          <input id="edit-contact-last" name="contactLastName" defaultValue={contact?.lastName ?? ""} disabled={pending} className={controlClassName} />
        </Field>
      </div>

      <Field label="Fonction" htmlFor="edit-contact-role">
        <input id="edit-contact-role" name="contactRole" defaultValue={contact?.role ?? ""} disabled={pending} className={controlClassName} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Téléphone du contact" htmlFor="edit-contact-phone">
          <input id="edit-contact-phone" name="contactPhone" type="tel" defaultValue={contact?.phone ?? ""} disabled={pending} className={controlClassName} />
        </Field>
        <Field label="E-mail du contact" htmlFor="edit-contact-email" error={firstError("contactEmail")}>
          <input id="edit-contact-email" name="contactEmail" type="email" defaultValue={contact?.email ?? ""} disabled={pending} className={controlClassName} />
        </Field>
      </div>

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
