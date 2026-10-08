"use client";

import { ChevronDown } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { createCompany } from "@/actions/companies";
import {
  CompanyTextArea,
  CompanyTextInput,
} from "@/components/crm/company-form-controls";
import { AppDialog } from "@/components/ui/app-dialog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { idleActionResult } from "@/lib/crm/action-result";
import {
  emptyProspectForm,
  patchCompanyForm,
  type ProspectFormState,
} from "@/lib/crm/company-form-state";
import { cn } from "@/lib/cn";

type CreateProspectDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (name: string) => void;
};

const MORE_INFO_FIELDS = [
  "address",
  "city",
  "postalCode",
  "phone",
  "email",
  "website",
  "linkedin",
  "contactFirstName",
  "contactLastName",
  "contactRole",
] as const;

export function CreateProspectDialog({
  open,
  onClose,
  onCreated,
}: CreateProspectDialogProps) {
  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="Nouveau prospect"
      description="Seul le nom est obligatoire. Le reste se complète ensuite. Statut initial : Lead."
    >
      {open ? (
        <CreateProspectForm onClose={onClose} onCreated={onCreated} />
      ) : null}
    </AppDialog>
  );
}

function CreateProspectForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (name: string) => void;
}) {
  const [state, formAction, pending] = useActionState(
    createCompany,
    idleActionResult,
  );
  const [moreOpen, setMoreOpen] = useState(false);
  const [form, setForm] = useState(emptyProspectForm);
  const nameRef = useRef<HTMLInputElement>(null);
  const setField = (key: keyof ProspectFormState) => (value: string) => {
    setForm((current) => patchCompanyForm(current, key, value));
  };

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  useEffect(() => {
    if (state.ok && state.data?.name) {
      onCreated(state.data.name);
    }
  }, [onCreated, state]);

  const firstError = (key: string) => state.fieldErrors?.[key]?.[0];
  const hasHiddenError = MORE_INFO_FIELDS.some((key) => Boolean(firstError(key)));
  const showMore = moreOpen || hasHiddenError;

  return (
    <form action={formAction} className="space-y-4">
      {state.message && !state.ok ? (
        <p
          className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-meta text-danger"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}

      <Field label="Nom" htmlFor="prospect-name" error={firstError("name")}>
        <CompanyTextInput
          inputRef={nameRef}
          id="prospect-name"
          name="name"
          required
          autoComplete="organization"
          disabled={pending}
          aria-invalid={Boolean(firstError("name"))}
          value={form.name}
          onValue={setField("name")}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Instagram" htmlFor="prospect-instagram" error={firstError("instagram")}>
          <CompanyTextInput
            id="prospect-instagram"
            name="instagram"
            placeholder="@compte"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={pending}
            aria-invalid={Boolean(firstError("instagram"))}
            value={form.instagram}
            onValue={setField("instagram")}
          />
        </Field>
        <Field label="Source" htmlFor="prospect-source" error={firstError("source")}>
          <CompanyTextInput
            id="prospect-source"
            name="source"
            placeholder="Instagram, terrain, recommandation…"
            disabled={pending}
            value={form.source}
            onValue={setField("source")}
          />
        </Field>
      </div>

      <Field label="Activité / secteur" htmlFor="prospect-industry" error={firstError("industry")}>
        <CompanyTextInput
          id="prospect-industry"
          name="industry"
          disabled={pending}
          value={form.industry}
          onValue={setField("industry")}
        />
      </Field>

      <Field label="Besoin / notes" htmlFor="prospect-notes" error={firstError("description")}>
        <CompanyTextArea
          id="prospect-notes"
          name="description"
          rows={3}
          placeholder="Ex. site vitrine"
          disabled={pending}
          value={form.description}
          onValue={setField("description")}
        />
      </Field>

      <div className="border-t border-border pt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMoreOpen((value) => !value)}
          aria-expanded={showMore}
          aria-controls="prospect-more-info"
          disabled={hasHiddenError}
        >
          <ChevronDown
            className={cn("size-4 transition-transform", showMore && "rotate-180")}
            aria-hidden
          />
          Plus d&apos;informations
        </Button>
      </div>

      <div id="prospect-more-info" hidden={!showMore} className="space-y-4">
        <Field label="Adresse" htmlFor="prospect-address" error={firstError("address")}>
          <CompanyTextInput
            id="prospect-address"
            name="address"
            autoComplete="street-address"
            disabled={pending}
            value={form.address}
            onValue={setField("address")}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ville" htmlFor="prospect-city" error={firstError("city")}>
            <CompanyTextInput
              id="prospect-city"
              name="city"
              disabled={pending}
              value={form.city}
              onValue={setField("city")}
            />
          </Field>
          <Field label="Code postal" htmlFor="prospect-postal" error={firstError("postalCode")}>
            <CompanyTextInput
              id="prospect-postal"
              name="postalCode"
              disabled={pending}
              value={form.postalCode}
              onValue={setField("postalCode")}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Téléphone" htmlFor="prospect-phone" error={firstError("phone")}>
            <CompanyTextInput
              id="prospect-phone"
              name="phone"
              type="tel"
              disabled={pending}
              value={form.phone}
              onValue={setField("phone")}
            />
          </Field>
          <Field label="E-mail" htmlFor="prospect-email" error={firstError("email")}>
            <CompanyTextInput
              id="prospect-email"
              name="email"
              type="email"
              disabled={pending}
              value={form.email}
              onValue={setField("email")}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Site internet" htmlFor="prospect-website" error={firstError("website")}>
            <CompanyTextInput
              id="prospect-website"
              name="website"
              inputMode="url"
              disabled={pending}
              value={form.website}
              onValue={setField("website")}
            />
          </Field>
          <Field label="LinkedIn" htmlFor="prospect-linkedin" error={firstError("linkedin")}>
            <CompanyTextInput
              id="prospect-linkedin"
              name="linkedin"
              inputMode="url"
              placeholder="linkedin.com/company/…"
              disabled={pending}
              value={form.linkedin}
              onValue={setField("linkedin")}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Prénom du contact" htmlFor="prospect-contact-first" error={firstError("contactFirstName")}>
            <CompanyTextInput
              id="prospect-contact-first"
              name="contactFirstName"
              disabled={pending}
              value={form.contactFirstName}
              onValue={setField("contactFirstName")}
            />
          </Field>
          <Field label="Nom du contact" htmlFor="prospect-contact-last" error={firstError("contactLastName")}>
            <CompanyTextInput
              id="prospect-contact-last"
              name="contactLastName"
              disabled={pending}
              value={form.contactLastName}
              onValue={setField("contactLastName")}
            />
          </Field>
        </div>

        <Field label="Fonction du contact" htmlFor="prospect-contact-role" error={firstError("contactRole")}>
          <CompanyTextInput
            id="prospect-contact-role"
            name="contactRole"
            disabled={pending}
            value={form.contactRole}
            onValue={setField("contactRole")}
          />
        </Field>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onClose} disabled={pending}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Création…" : "Créer le prospect"}
        </Button>
      </div>
    </form>
  );
}
