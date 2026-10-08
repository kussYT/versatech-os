"use client";

import { useActionState, useEffect, useState } from "react";
import { updateCompany } from "@/actions/companies";
import {
  CompanySelect,
  CompanyTextArea,
  CompanyTextInput,
} from "@/components/crm/company-form-controls";
import { AppDialog } from "@/components/ui/app-dialog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { idleActionResult } from "@/lib/crm/action-result";
import {
  COMPANY_LIFECYCLE_LABELS,
  PRIORITY_LABELS,
} from "@/lib/crm/constants";
import {
  editCompanyFormState,
  patchCompanyForm,
  type EditCompanyFormState,
} from "@/lib/crm/company-form-state";
import type { CompanyDetail } from "@/lib/queries/companies";

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
  const [form, setForm] = useState(() => editCompanyFormState(company));
  const firstError = (key: string) => state.fieldErrors?.[key]?.[0];
  const setField = (key: keyof EditCompanyFormState) => (value: string) => {
    setForm((current) => patchCompanyForm(current, key, value));
  };

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
        <CompanyTextInput
          id="edit-name"
          name="name"
          required
          disabled={pending}
          value={form.name}
          onValue={setField("name")}
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
          <CompanySelect
            id="edit-lifecycle"
            name="lifecycleStatus"
            disabled={pending}
            value={form.lifecycleStatus}
            onValue={setField("lifecycleStatus")}
          >
            {company.allowedLifecycleStatuses.map((value) => (
              <option key={value} value={value}>
                {COMPANY_LIFECYCLE_LABELS[value]}
              </option>
            ))}
          </CompanySelect>
        </Field>
        <Field label="Priorité" htmlFor="edit-priority" error={firstError("priority")}>
          <CompanySelect
            id="edit-priority"
            name="priority"
            disabled={pending}
            value={form.priority}
            onValue={setField("priority")}
          >
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </CompanySelect>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Secteur" htmlFor="edit-industry">
          <CompanyTextInput
            id="edit-industry"
            name="industry"
            disabled={pending}
            value={form.industry}
            onValue={setField("industry")}
          />
        </Field>
        <Field label="Ville" htmlFor="edit-city">
          <CompanyTextInput
            id="edit-city"
            name="city"
            disabled={pending}
            value={form.city}
            onValue={setField("city")}
          />
        </Field>
      </div>

      <Field label="Adresse" htmlFor="edit-address" error={firstError("address")}>
        <CompanyTextInput
          id="edit-address"
          name="address"
          disabled={pending}
          value={form.address}
          onValue={setField("address")}
        />
      </Field>
      <Field label="Code postal" htmlFor="edit-postal">
        <CompanyTextInput
          id="edit-postal"
          name="postalCode"
          disabled={pending}
          value={form.postalCode}
          onValue={setField("postalCode")}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Téléphone" htmlFor="edit-phone">
          <CompanyTextInput
            id="edit-phone"
            name="phone"
            type="tel"
            disabled={pending}
            value={form.phone}
            onValue={setField("phone")}
          />
        </Field>
        <Field label="E-mail" htmlFor="edit-email" error={firstError("email")}>
          <CompanyTextInput
            id="edit-email"
            name="email"
            type="email"
            disabled={pending}
            value={form.email}
            onValue={setField("email")}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Site internet" htmlFor="edit-website" error={firstError("website")}>
          <CompanyTextInput
            id="edit-website"
            name="website"
            disabled={pending}
            value={form.website}
            onValue={setField("website")}
          />
        </Field>
        <Field label="Source" htmlFor="edit-source">
          <CompanyTextInput
            id="edit-source"
            name="source"
            disabled={pending}
            value={form.source}
            onValue={setField("source")}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Instagram" htmlFor="edit-instagram" error={firstError("instagram")}>
          <CompanyTextInput
            id="edit-instagram"
            name="instagram"
            placeholder="@compte"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={pending}
            value={form.instagram}
            onValue={setField("instagram")}
          />
        </Field>
        <Field label="LinkedIn" htmlFor="edit-linkedin" error={firstError("linkedin")}>
          <CompanyTextInput
            id="edit-linkedin"
            name="linkedin"
            inputMode="url"
            placeholder="linkedin.com/company/…"
            disabled={pending}
            value={form.linkedin}
            onValue={setField("linkedin")}
          />
        </Field>
      </div>

      <Field label="Notes" htmlFor="edit-notes">
        <CompanyTextArea
          id="edit-notes"
          name="description"
          rows={3}
          disabled={pending}
          value={form.description}
          onValue={setField("description")}
        />
      </Field>

      <p className="text-meta font-medium tracking-[0.08em] text-muted uppercase">
        Contact principal
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prénom" htmlFor="edit-contact-first" error={firstError("contactFirstName")}>
          <CompanyTextInput
            id="edit-contact-first"
            name="contactFirstName"
            disabled={pending}
            value={form.contactFirstName}
            onValue={setField("contactFirstName")}
          />
        </Field>
        <Field label="Nom" htmlFor="edit-contact-last" error={firstError("contactLastName")}>
          <CompanyTextInput
            id="edit-contact-last"
            name="contactLastName"
            disabled={pending}
            value={form.contactLastName}
            onValue={setField("contactLastName")}
          />
        </Field>
      </div>

      <Field label="Fonction" htmlFor="edit-contact-role">
        <CompanyTextInput
          id="edit-contact-role"
          name="contactRole"
          disabled={pending}
          value={form.contactRole}
          onValue={setField("contactRole")}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Téléphone du contact" htmlFor="edit-contact-phone">
          <CompanyTextInput
            id="edit-contact-phone"
            name="contactPhone"
            type="tel"
            disabled={pending}
            value={form.contactPhone}
            onValue={setField("contactPhone")}
          />
        </Field>
        <Field label="E-mail du contact" htmlFor="edit-contact-email" error={firstError("contactEmail")}>
          <CompanyTextInput
            id="edit-contact-email"
            name="contactEmail"
            type="email"
            disabled={pending}
            value={form.contactEmail}
            onValue={setField("contactEmail")}
          />
        </Field>
      </div>

      {state.data?.confirmationToken ? (
        <input type="hidden" name="confirmationToken" value={state.data.confirmationToken} />
      ) : null}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onClose} disabled={pending}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending
            ? "Enregistrement…"
            : state.data?.confirmationToken
              ? "Confirmer"
              : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
