"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  createCompany,
  searchProspectDuplicates,
} from "@/actions/companies";
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
import {
  PROSPECT_DUPLICATE_MIN_LENGTH,
  formatProspectDuplicateSubtitle,
  type ProspectDuplicateHit,
} from "@/lib/crm/prospect-duplicates";
import { SEARCH_DEBOUNCE_MS } from "@/lib/crm/search";
import { cn } from "@/lib/cn";

type CreateProspectDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (name: string) => void;
};

/** Tous les champs hors nom — repliés par défaut. */
const MORE_INFO_FIELDS = [
  "instagram",
  "source",
  "industry",
  "description",
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
  const router = useRouter();
  const duplicatesListId = useId();
  const [state, formAction, pending] = useActionState(
    createCompany,
    idleActionResult,
  );
  const [moreOpen, setMoreOpen] = useState(false);
  const [form, setForm] = useState(emptyProspectForm);
  const [duplicates, setDuplicates] = useState<ProspectDuplicateHit[]>([]);
  const [duplicatesPending, startDuplicatesTransition] = useTransition();
  const [duplicatesError, setDuplicatesError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const searchRequestId = useRef(0);

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

  const trimmedName = form.name.trim();
  const canSearchDuplicates = trimmedName.length >= PROSPECT_DUPLICATE_MIN_LENGTH;

  useEffect(() => {
    if (!canSearchDuplicates) {
      return;
    }

    const query = trimmedName;
    const requestId = ++searchRequestId.current;
    const timer = window.setTimeout(() => {
      startDuplicatesTransition(async () => {
        const result = await searchProspectDuplicates(query);
        if (requestId !== searchRequestId.current) {
          return;
        }
        if (!result.ok) {
          setDuplicates([]);
          setDuplicatesError(result.message ?? "Recherche indisponible.");
          return;
        }
        setDuplicatesError(null);
        setDuplicates(result.items);
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [canSearchDuplicates, trimmedName]);

  const firstError = (key: string) => state.fieldErrors?.[key]?.[0];
  const hasHiddenError = MORE_INFO_FIELDS.some((key) => Boolean(firstError(key)));
  const showMore = moreOpen || hasHiddenError;
  const visibleDuplicates = canSearchDuplicates ? duplicates : [];
  const visibleDuplicatesError = canSearchDuplicates ? duplicatesError : null;
  const hasDuplicates = visibleDuplicates.length > 0;
  const submitLabel = pending
    ? "Création…"
    : hasDuplicates
      ? "Créer quand même"
      : "Créer le prospect";

  function openExisting(companyId: string) {
    onClose();
    router.push(`/entreprises/${companyId}`);
  }

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
        <CompanyTextInput
          inputRef={nameRef}
          id="prospect-name"
          name="name"
          required
          autoComplete="organization"
          disabled={pending}
          aria-invalid={Boolean(firstError("name"))}
          aria-describedby={hasDuplicates ? duplicatesListId : undefined}
          value={form.name}
          onValue={setField("name")}
        />
      </Field>

      {duplicatesPending && canSearchDuplicates ? (
        <p className="text-meta text-muted" role="status">
          Recherche d&apos;entreprises similaires…
        </p>
      ) : null}

      {visibleDuplicatesError ? (
        <p className="text-meta text-muted" role="status">
          {visibleDuplicatesError}
        </p>
      ) : null}

      {hasDuplicates ? (
        <div
          id={duplicatesListId}
          className="rounded-xl border border-warning/35 bg-warning/10 px-3 py-3"
          role="region"
          aria-label="Entreprises similaires"
        >
          <p className="text-meta font-medium text-foreground">
            Des entreprises similaires existent déjà
          </p>
          <ul className="mt-2 space-y-2">
            {visibleDuplicates.map((hit) => (
              <li
                key={hit.id}
                className="flex flex-col gap-2 rounded-lg bg-white/55 px-2.5 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-body font-medium text-foreground">{hit.name}</p>
                  <p className="truncate text-meta text-muted">
                    {formatProspectDuplicateSubtitle(hit)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="min-h-11 shrink-0 sm:min-h-9"
                  disabled={pending}
                  onClick={() => openExisting(hit.id)}
                >
                  Ouvrir cette entreprise
                </Button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-meta text-muted">
            Aucune fusion automatique. Vous pouvez ouvrir une fiche existante ou
            créer un nouveau prospect.
          </p>
        </div>
      ) : null}

      <div className="border-t border-border pt-3">
        <Button
          type="button"
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

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onClose} disabled={pending} className="min-h-11">
          Annuler
        </Button>
        <Button type="submit" disabled={pending} className="min-h-11">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
