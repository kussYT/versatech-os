"use client";

import { useActionState, useEffect, useRef } from "react";
import { createCompany } from "@/actions/companies";
import { AppDialog } from "@/components/ui/app-dialog";
import { Button } from "@/components/ui/button";
import { Field, controlClassName } from "@/components/ui/field";
import { idleActionResult } from "@/lib/crm/action-result";
import { cn } from "@/lib/cn";

type CreateProspectDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (name: string) => void;
};

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
      description="Le statut initial sera Lead. Les champs hors nom sont facultatifs."
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
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  useEffect(() => {
    if (state.ok && state.data?.name) {
      onCreated(state.data.name);
    }
  }, [onCreated, state]);

  const firstError = (key: string) => state.fieldErrors?.[key]?.[0];

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

      <Field label="Nom de l'entreprise" htmlFor="prospect-name" error={firstError("name")}>
        <input
          ref={nameRef}
          id="prospect-name"
          name="name"
          required
          autoComplete="organization"
          disabled={pending}
          aria-invalid={Boolean(firstError("name"))}
          className={controlClassName}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Secteur" htmlFor="prospect-industry" error={firstError("industry")}>
          <input id="prospect-industry" name="industry" disabled={pending} className={controlClassName} />
        </Field>
        <Field label="Ville" htmlFor="prospect-city" error={firstError("city")}>
          <input id="prospect-city" name="city" disabled={pending} className={controlClassName} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Téléphone" htmlFor="prospect-phone" error={firstError("phone")}>
          <input id="prospect-phone" name="phone" type="tel" disabled={pending} className={controlClassName} />
        </Field>
        <Field label="E-mail" htmlFor="prospect-email" error={firstError("email")}>
          <input id="prospect-email" name="email" type="email" disabled={pending} className={controlClassName} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Site internet" htmlFor="prospect-website" error={firstError("website")}>
          <input id="prospect-website" name="website" inputMode="url" disabled={pending} className={controlClassName} />
        </Field>
        <Field label="Source" htmlFor="prospect-source" error={firstError("source")}>
          <input id="prospect-source" name="source" disabled={pending} className={controlClassName} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prénom du contact" htmlFor="prospect-contact-first" error={firstError("contactFirstName")}>
          <input id="prospect-contact-first" name="contactFirstName" disabled={pending} className={controlClassName} />
        </Field>
        <Field label="Nom du contact" htmlFor="prospect-contact-last" error={firstError("contactLastName")}>
          <input id="prospect-contact-last" name="contactLastName" disabled={pending} className={controlClassName} />
        </Field>
      </div>

      <Field label="Fonction du contact" htmlFor="prospect-contact-role" error={firstError("contactRole")}>
        <input id="prospect-contact-role" name="contactRole" disabled={pending} className={controlClassName} />
      </Field>

      <Field label="Notes" htmlFor="prospect-notes" error={firstError("description")}>
        <textarea
          id="prospect-notes"
          name="description"
          rows={3}
          disabled={pending}
          className={cn(controlClassName, "min-h-24 resize-y")}
        />
      </Field>

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
