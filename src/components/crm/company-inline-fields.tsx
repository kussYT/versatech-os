"use client";

import { Pencil, Plus } from "lucide-react";
import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { updateCompanyField } from "@/actions/companies";
import { Button } from "@/components/ui/button";
import { controlClassName } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import type { CompanyProfileField } from "@/lib/crm/company-profile";
import { instagramProfileUrl, normalizeLinkedinUrl } from "@/lib/crm/social";

type CompanyInlineFieldsProps = {
  companyId: string;
  values: Record<CompanyProfileField, string | null>;
};

type FieldRow = {
  field: CompanyProfileField;
  label: string;
  emptyLabel: string;
  inputType?: "email" | "tel" | "text";
  inputMode?: "email" | "tel" | "url" | "text";
  autoComplete?: string;
  placeholder?: string;
  spellCheck?: boolean;
  draftFromStored: (stored: string) => string;
  renderStored: (stored: string) => ReactNode;
};

const ROWS = [
  {
    field: "email",
    label: "E-mail",
    emptyLabel: "Non renseigné",
    inputType: "email",
    inputMode: "email",
    autoComplete: "email",
    spellCheck: false,
    draftFromStored: (stored) => stored,
    renderStored: (stored) => (
      <a href={`mailto:${stored}`} className="break-all text-primary hover:text-primary-hover">
        {stored}
      </a>
    ),
  },
  {
    field: "phone",
    label: "Téléphone",
    emptyLabel: "Non renseigné",
    inputType: "tel",
    inputMode: "tel",
    autoComplete: "tel",
    draftFromStored: (stored) => stored,
    renderStored: (stored) => (
      <a href={`tel:${stored}`} className="text-primary hover:text-primary-hover">
        {stored}
      </a>
    ),
  },
  {
    field: "instagram",
    label: "Instagram",
    emptyLabel: "Non renseigné",
    placeholder: "@compte",
    spellCheck: false,
    draftFromStored: (stored) => `@${stored}`,
    renderStored: (stored) => {
      const href = instagramProfileUrl(stored);
      if (!href) {
        return <span className="break-all">{stored}</span>;
      }
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-primary hover:text-primary-hover"
        >
          @{stored}
        </a>
      );
    },
  },
  {
    field: "website",
    label: "Site internet",
    emptyLabel: "Non renseigné",
    inputMode: "url",
    autoComplete: "url",
    spellCheck: false,
    draftFromStored: (stored) => stored,
    renderStored: (stored) => (
      <a
        href={stored}
        target="_blank"
        rel="noreferrer"
        className="break-all text-primary hover:text-primary-hover"
      >
        {stored}
      </a>
    ),
  },
  {
    field: "address",
    label: "Adresse",
    emptyLabel: "Non renseignée",
    autoComplete: "street-address",
    draftFromStored: (stored) => stored,
    renderStored: (stored) => <span className="break-words">{stored}</span>,
  },
  {
    field: "city",
    label: "Ville",
    emptyLabel: "Non renseignée",
    autoComplete: "address-level2",
    draftFromStored: (stored) => stored,
    renderStored: (stored) => <span>{stored}</span>,
  },
  {
    field: "postalCode",
    label: "Code postal",
    emptyLabel: "Non renseigné",
    autoComplete: "postal-code",
    draftFromStored: (stored) => stored,
    renderStored: (stored) => <span>{stored}</span>,
  },
  {
    field: "linkedin",
    label: "LinkedIn",
    emptyLabel: "Non renseigné",
    inputMode: "url",
    placeholder: "linkedin.com/company/…",
    spellCheck: false,
    draftFromStored: (stored) => stored,
    renderStored: (stored) => {
      const parsed = normalizeLinkedinUrl(stored);
      const href = parsed.ok ? parsed.value : null;
      if (!href) {
        return <span className="break-all">{stored}</span>;
      }
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-primary hover:text-primary-hover"
        >
          {href.replace(/^https:\/\/(www\.)?/, "")}
        </a>
      );
    },
  },
  {
    field: "industry",
    label: "Activité",
    emptyLabel: "Non renseignée",
    draftFromStored: (stored) => stored,
    renderStored: (stored) => <span className="break-words">{stored}</span>,
  },
  {
    field: "source",
    label: "Source",
    emptyLabel: "Non renseignée",
    draftFromStored: (stored) => stored,
    renderStored: (stored) => <span className="break-words">{stored}</span>,
  },
] as const satisfies readonly FieldRow[];

type MissingProfileField = Exclude<CompanyProfileField, (typeof ROWS)[number]["field"]>;
function assertProfileRows(rows: MissingProfileField extends never ? readonly FieldRow[] : never) {
  return rows.length === COMPANY_PROFILE_FIELD_COUNT;
}

const COMPANY_PROFILE_FIELD_COUNT = 10;
assertProfileRows(ROWS);

export function CompanyInlineFields({ companyId, values }: CompanyInlineFieldsProps) {
  return (
    <>
      {ROWS.map((row) => (
        <CompanyInlineField
          key={row.field}
          companyId={companyId}
          row={row}
          value={values[row.field]}
        />
      ))}
    </>
  );
}

function CompanyInlineField({
  companyId,
  row,
  value,
}: {
  companyId: string;
  row: FieldRow;
  value: string | null;
}) {
  const router = useRouter();
  const inputId = useId();
  const [override, setOverride] = useState<string | null | undefined>(undefined);
  const [serverValue, setServerValue] = useState(value);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState(false);
  const serverChanged = serverValue !== value;
  if (serverChanged) {
    setServerValue(value);
    setOverride(undefined);
  }
  const displayed = serverChanged || override === undefined ? value : override;

  useEffect(() => {
    if (!notice) {
      return;
    }
    const timeout = window.setTimeout(() => setNotice(false), 2200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  function open() {
    setDraft(displayed ? row.draftFromStored(displayed) : "");
    setError(null);
    setNotice(false);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setError(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await updateCompanyField({
        companyId,
        field: row.field,
        value: draft,
      });
      if (!result.ok) {
        setError(result.fieldErrors?.[row.field]?.[0] ?? result.message ?? "Impossible d'enregistrer.");
        return;
      }
      setOverride(result.data?.savedValue ?? null);
      setEditing(false);
      setNotice(true);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <dt id={`${inputId}-label`} className="text-meta text-faint">
        {row.label}
      </dt>
      <dd className="mt-0.5 text-body text-foreground">
        {editing ? (
          <form onSubmit={onSubmit} className="space-y-2">
            <input
              id={inputId}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              type={row.inputType ?? "text"}
              inputMode={row.inputMode}
              autoComplete={row.autoComplete}
              placeholder={row.placeholder}
              spellCheck={row.spellCheck}
              autoCapitalize={row.field === "instagram" ? "none" : undefined}
              autoCorrect={row.field === "instagram" ? "off" : undefined}
              disabled={pending}
              autoFocus
              aria-labelledby={`${inputId}-label`}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${inputId}-error` : undefined}
              className={cn(controlClassName, "min-h-10")}
            />
            {error ? (
              <p id={`${inputId}-error`} className="text-meta text-danger" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm" className="min-h-10" disabled={pending}>
                {pending ? "Enregistrement…" : "Enregistrer"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="min-h-10"
                onClick={cancel}
                disabled={pending}
              >
                Annuler
              </Button>
            </div>
          </form>
        ) : displayed ? (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">{row.renderStored(displayed)}</div>
            <div className="flex shrink-0 items-center gap-1">
              {notice ? <SavedNotice /> : null}
              <Button
                variant="ghost"
                size="sm"
                className="min-h-10 min-w-10"
                aria-label={`Modifier ${row.label}`}
                onClick={open}
              >
                <Pencil className="size-4" aria-hidden />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span className="text-faint">{row.emptyLabel}</span>
            <div className="flex shrink-0 items-center gap-1">
              {notice ? <SavedNotice /> : null}
              <Button variant="ghost" size="sm" className="min-h-10" onClick={open}>
                <Plus className="size-4" aria-hidden />
                Ajouter
              </Button>
            </div>
          </div>
        )}
      </dd>
    </div>
  );
}

function SavedNotice() {
  return (
    <span className="vt-inline-saved text-meta text-faint" role="status">
      Enregistré
    </span>
  );
}
