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

const pillClass =
  "rounded-full border border-white/70 bg-white/50 px-3.5 py-1.5 text-meta text-muted transition-colors duration-hover hover:border-primary/30 hover:bg-white/75 hover:text-foreground focus-visible:border-primary";

const pillActiveClass =
  "rounded-full border border-primary/35 bg-primary/10 px-3.5 py-1.5 text-meta font-medium text-primary shadow-[0_1px_2px_rgb(31_41_80/0.06)]";

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
      <Card className="p-4 sm:p-5">
        <label className="relative block">
          <span className="sr-only">Rechercher</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Entreprise, secteur, ville, contact"
            className={cn(controlClassName, "h-11 pl-10")}
          />
        </label>

        <div className="mt-3.5 flex flex-wrap gap-2" role="group" aria-label="Statut">
          <button
            type="button"
            className={status === "all" ? pillActiveClass : pillClass}
            onClick={() => setStatus("all")}
          >
            Tous
          </button>
          {statuses.map((value) => (
            <button
              key={value}
              type="button"
              className={status === value ? pillActiveClass : pillClass}
              onClick={() => setStatus(value)}
            >
              {COMPANY_LIFECYCLE_LABELS[value as CompanyLifecycle]}
            </button>
          ))}
        </div>

        <details className="mt-3.5">
          <summary className="cursor-pointer text-meta text-muted transition-colors hover:text-foreground">
            Plus de filtres
          </summary>
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
          <p className="text-meta text-faint">
            {filtered.length} entreprise{filtered.length > 1 ? "s" : ""}
          </p>

          <div className="grid gap-3 md:hidden">
            {filtered.map((company) => (
              <Link
                key={company.id}
                href={`/entreprises/${company.id}`}
                className="glass-card block rounded-[1.25rem] p-4 transition-colors duration-hover hover:bg-white/70"
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
                    <dd
                      className={cn(
                        "text-foreground",
                        followUpStatus(company) === "En retard" && "font-medium text-danger",
                      )}
                    >
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
                <thead className="border-b border-white/60 bg-white/45 text-meta tracking-[0.06em] text-muted uppercase">
                  <tr>
                    <th className="px-4 py-3.5 font-medium">Entreprise</th>
                    <th className="px-4 py-3.5 font-medium">Type</th>
                    <th className="px-4 py-3.5 font-medium">Étape</th>
                    <th className="px-4 py-3.5 font-medium">Prestation</th>
                    <th className="px-4 py-3.5 font-medium">Prochaine action</th>
                    <th className="px-4 py-3.5 font-medium">Date relance</th>
                    <th className="px-4 py-3.5 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((company) => (
                    <tr
                      key={company.id}
                      className="relative border-b border-white/50 last:border-0 hover:bg-white/40"
                    >
                      <td className="px-4 py-3.5">
                        <Link
                          href={`/entreprises/${company.id}`}
                          className="font-medium text-foreground after:absolute after:inset-0"
                        >
                          {company.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 text-muted">{companyKind(company)}</td>
                      <td className="px-4 py-3.5">
                        <LifecycleBadge status={company.lifecycleStatus} />
                      </td>
                      <td className="px-4 py-3.5 text-muted">{company.prestation ?? "—"}</td>
                      <td className="px-4 py-3.5 text-muted">{nextActionLabel(company)}</td>
                      <td className="px-4 py-3.5 text-muted">{nextActionDate(company)}</td>
                      <td
                        className={cn(
                          "px-4 py-3.5 text-muted",
                          followUpStatus(company) === "En retard" && "font-medium text-danger",
                        )}
                      >
                        {followUpStatus(company)}
                      </td>
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
