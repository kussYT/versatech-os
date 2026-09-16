"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { geocodeCompanyForm, saveCompanyLocationForm } from "@/actions/map";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, controlClassName } from "@/components/ui/field";
import { LifecycleBadge } from "@/components/ui/lifecycle-badge";
import { COMPANY_LIFECYCLE_LABELS } from "@/lib/crm/constants";
import { formatCompanyAddress } from "@/lib/prospection/map-model";
import {
  MAP_FILTERS,
  MAP_FILTER_LABELS,
  filterMapCompanies,
  incompleteLocationCompanies,
  type MapCompany,
  type MapFilter,
} from "@/lib/prospection/map-model";

const ProspectMapCanvas = dynamic(
  () => import("@/components/map/prospect-map-canvas").then((mod) => mod.ProspectMapCanvas),
  { ssr: false, loading: () => <div className="h-[min(70vh,40rem)] rounded-xl bg-surface-high" /> },
);

type CarteViewProps = {
  companies: MapCompany[];
  todayVisitIds: string[];
  geocoderConfigured: boolean;
};

export function CarteView({ companies, todayVisitIds, geocoderConfigured }: CarteViewProps) {
  const [filter, setFilter] = useState<MapFilter>("all");
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");

  const visible = useMemo(
    () => filterMapCompanies(companies, { filter, query, city, todayVisitIds }),
    [city, companies, filter, query, todayVisitIds],
  );
  const incomplete = incompleteLocationCompanies(visible);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap gap-2 border-b border-border p-3">
          {MAP_FILTERS.map((value) => (
            <Button
              key={value}
              size="sm"
              variant={filter === value ? "primary" : "secondary"}
              onClick={() => setFilter(value)}
            >
              {MAP_FILTER_LABELS[value]}
            </Button>
          ))}
        </div>
        <div className="grid gap-3 border-b border-border p-3 sm:grid-cols-2">
          <Field label="Recherche" htmlFor="map-search">
            <input
              id="map-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={controlClassName}
              placeholder="Nom d'entreprise"
            />
          </Field>
          <Field label="Ville" htmlFor="map-city">
            <input
              id="map-city"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              className={controlClassName}
              placeholder="Lyon, Paris…"
            />
          </Field>
        </div>
        <ProspectMapCanvas companies={visible} />
      </Card>

      <Card className="p-4">
        <h2 className="text-section text-foreground">Localisation à compléter</h2>
        <p className="mt-1 text-meta text-muted">
          {geocoderConfigured
            ? "Géocodage Nominatim à la demande, jamais au rendu de la carte."
            : "Aucun géocodeur configuré. Saisissez l'adresse et les coordonnées."}
        </p>
        {incomplete.length === 0 ? (
          <p className="mt-4 text-body text-muted">Toutes les entreprises visibles ont des coordonnées.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {incomplete.slice(0, 40).map((company) => (
              <li key={company.id} className="rounded-xl border border-border bg-background/50 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/entreprises/${company.id}`} className="text-body font-medium text-foreground">
                    {company.name}
                  </Link>
                  <LifecycleBadge status={company.lifecycleStatus} />
                </div>
                <p className="mt-1 text-meta text-muted">
                  {formatCompanyAddress(company) || "Adresse manquante"}
                </p>
                <p className="mt-1 text-meta text-faint">{COMPANY_LIFECYCLE_LABELS[company.lifecycleStatus]}</p>
                <IncompleteLocationActions company={company} geocoderConfigured={geocoderConfigured} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function IncompleteLocationActions({
  company,
  geocoderConfigured,
}: {
  company: MapCompany;
  geocoderConfigured: boolean;
}) {
  return (
    <div className="mt-3 space-y-2">
      {geocoderConfigured && formatCompanyAddress(company) ? (
        <form action={geocodeCompanyForm}>
          <input type="hidden" name="companyId" value={company.id} />
          <Button type="submit" size="sm" variant="secondary">
            Géocoder l&apos;adresse
          </Button>
        </form>
      ) : null}
      <form action={saveCompanyLocationForm} className="grid grid-cols-2 gap-2">
        <input type="hidden" name="companyId" value={company.id} />
        <input name="latitude" placeholder="Lat" className={controlClassName} />
        <input name="longitude" placeholder="Lng" className={controlClassName} />
        <Button type="submit" size="sm" className="col-span-2">
          Enregistrer les coordonnées
        </Button>
      </form>
    </div>
  );
}
