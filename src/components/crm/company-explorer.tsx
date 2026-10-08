"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LifecycleBadge } from "@/components/ui/lifecycle-badge";
import { NewProspectButton } from "@/components/crm/new-prospect-button";
import { controlClassName } from "@/components/ui/field";
import type { CompanyLifecycle, Priority } from "@/generated/prisma/client";
import {
  COMPANY_LIFECYCLE_LABELS,
  PRIORITY_LABELS,
} from "@/lib/crm/constants";
import { formatDate } from "@/lib/crm/form-data";
import { dueBucket } from "@/lib/dates";
import type { CompanyListItem } from "@/lib/queries/companies";
import { cn } from "@/lib/cn";

type CompanyExplorerProps = {
  companies: CompanyListItem[];
  variant: "prospects" | "all";
};

function contactLabel(company: CompanyListItem) {
  if (!company.primaryContact) {
    return "—";
  }
  return `${company.primaryContact.firstName} ${company.primaryContact.lastName}`;
}

function nextActionLabel(company: CompanyListItem) {
  return company.nextFollowUpTitle ?? "—";
}

function nextActionDate(company: CompanyListItem) {
  return company.nextFollowUpAt ? formatDate(company.nextFollowUpAt) : "—";
}

function followUpStatus(company: CompanyListItem) {
  if (!company.nextFollowUpAt) {
    return "—";
  }
  const bucket = dueBucket(new Date(company.nextFollowUpAt));
  if (bucket === "overdue") {
    return "En retard";
  }
  if (bucket === "today") {
    return "Aujourd'hui";
  }
  return "À venir";
}

function companyKind(company: CompanyListItem) {
  return company.lifecycleStatus === "CLIENT" ? "Client" : "Prospect";
}

export function CompanyExplorer({ companies, variant }: CompanyExplorerProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [industry, setIndustry] = useState("all");
  const [city, setCity] = useState("all");
  const [priority, setPriority] = useState("all");

  const industries = useMemo(
    () => unique(companies.map((company) => company.industry)),
    [companies],
  );
  const cities = useMemo(
    () => unique(companies.map((company) => company.city)),
    [companies],
  );
  const statuses = useMemo(
    () => unique(companies.map((company) => company.lifecycleStatus)),
    [companies],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return companies.filter((company) => {
      if (status !== "all" && company.lifecycleStatus !== status) {
        return false;
      }
      if (industry !== "all" && company.industry !== industry) {
        return false;
      }
      if (city !== "all" && company.city !== city) {
        return false;
      }
      if (priority !== "all" && company.priority !== priority) {
        return false;
      }
      if (!needle) {
        return true;
      }
      const haystack = [
        company.name,
        company.industry,
        company.city,
        company.prestation,
        contactLabel(company),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [city, companies, industry, priority, query, status]);

  if (companies.length === 0) {
    return (
      <Card className="px-5">
        <EmptyState
          title={
            variant === "prospects"
              ? "Aucun prospect pour le moment"
              : "Aucune entreprise"
          }
          description={
            variant === "prospects"
              ? "Ajoutez un prospect pour commencer le suivi commercial."
              : "Les entreprises créées apparaîtront ici."
          }
          action={
            variant === "prospects" ? (
              <NewProspectButton>Ajouter un prospect</NewProspectButton>
            ) : (
              <NewProspectButton>Nouveau prospect</NewProspectButton>
            )
          }
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))]">
          <label className="relative block">
            <span className="sr-only">Rechercher</span>
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Entreprise, secteur, ville, contact"
              className={cn(controlClassName, "pl-9")}
            />
          </label>
          <FilterSelect
            label="Statut"
            value={status}
            onChange={setStatus}
            options={statuses.map((value) => ({
              value,
              label: COMPANY_LIFECYCLE_LABELS[value as CompanyLifecycle],
            }))}
          />
        </div>
        <details className="mt-3">
          <summary className="cursor-pointer text-meta text-muted">Plus de filtres</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <FilterSelect
              label="Secteur"
              value={industry}
              onChange={setIndustry}
              options={industries.map((value) => ({ value, label: value }))}
            />
            <FilterSelect
              label="Ville"
              value={city}
              onChange={setCity}
              options={cities.map((value) => ({ value, label: value }))}
            />
            <FilterSelect
              label="Priorité"
              value={priority}
              onChange={setPriority}
              options={(Object.keys(PRIORITY_LABELS) as Priority[]).map((value) => ({
                value,
                label: PRIORITY_LABELS[value],
              }))}
            />
          </div>
        </details>
      </Card>

      {filtered.length === 0 ? (
        <Card className="px-5">
          <EmptyState
            title="Aucun résultat"
            description="Aucun enregistrement ne correspond à la recherche ou aux filtres."
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {filtered.map((company) => (
              <Link
                key={company.id}
                href={`/entreprises/${company.id}`}
                className="foil-subtle rounded-card card-sheen border border-border bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{company.name}</p>
                    <p className="mt-1 text-meta text-muted">
                      {[companyKind(company), COMPANY_LIFECYCLE_LABELS[company.lifecycleStatus], company.prestation]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <LifecycleBadge status={company.lifecycleStatus} />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-meta">
                  <div>
                    <dt className="text-faint">Prochaine action</dt>
                    <dd className="text-foreground">{nextActionLabel(company)}</dd>
                  </div>
                  <div>
                    <dt className="text-faint">Relance</dt>
                    <dd className="text-foreground">
                      {nextActionDate(company)} · {followUpStatus(company)}
                    </dd>
                  </div>
                </dl>
              </Link>
            ))}
          </div>

          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[52rem] text-left text-body">
                <thead className="border-b border-border bg-surface-high/60 text-meta tracking-[0.08em] text-muted uppercase">
                  <tr>
                    <th className="px-4 py-3 font-medium">Entreprise</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Étape</th>
                    <th className="px-4 py-3 font-medium">Prestation</th>
                    <th className="px-4 py-3 font-medium">Prochaine action</th>
                    <th className="px-4 py-3 font-medium">Date relance</th>
                    <th className="px-4 py-3 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((company) => (
                    <tr
                      key={company.id}
                      className="relative border-b border-border/70 last:border-0 hover:bg-surface-high/40"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/entreprises/${company.id}`}
                          className="font-medium text-foreground after:absolute after:inset-0"
                        >
                          {company.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted">{companyKind(company)}</td>
                      <td className="px-4 py-3">
                        <LifecycleBadge status={company.lifecycleStatus} />
                      </td>
                      <td className="px-4 py-3 text-muted">{company.prestation ?? "—"}</td>
                      <td className="px-4 py-3 text-muted">{nextActionLabel(company)}</td>
                      <td className="px-4 py-3 text-muted">{nextActionDate(company)}</td>
                      <td className="px-4 py-3 text-muted">{followUpStatus(company)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function unique(values: (string | null)[]) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort(
    (a, b) => a.localeCompare(b, "fr"),
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={controlClassName}
      >
        <option value="all">{label} · tous</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
