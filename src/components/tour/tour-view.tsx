"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  addCompanyToTodayTourForm,
  ensureTodayTourForm,
  markTourStopVisitedForm,
  moveTourStopForm,
  removeCompanyFromTodayTourForm,
} from "@/actions/tours";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { controlClassName } from "@/components/ui/field";
import { LifecycleBadge } from "@/components/ui/lifecycle-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCompanyAddress, externalItineraryUrl } from "@/lib/prospection/itinerary";
import type { TodayTour } from "@/lib/queries/tours";

type TourViewProps = {
  tour: TodayTour | null;
  companies: { id: string; name: string; city: string | null }[];
  addCompanyId?: string;
};

export function TourView({ tour, companies, addCompanyId }: TourViewProps) {
  const router = useRouter();
  useEffect(() => {
    if (!addCompanyId) {
      return;
    }
    const formData = new FormData();
    formData.set("companyId", addCompanyId);
    void addCompanyToTodayTourForm(formData).then(() => router.refresh());
  }, [addCompanyId, router]);

  return (
    <div className="space-y-4">
      <form action={ensureTodayTourForm}>
        <Button type="submit">{tour ? "Tournée du jour prête" : "Créer ma tournée du jour"}</Button>
      </form>

      {tour ? (
        <>
          <Card className="p-4">
            <h2 className="text-section text-foreground">Ajouter une entreprise</h2>
            <form action={addCompanyToTodayTourForm} className="mt-3 flex flex-col gap-2 sm:flex-row">
              <select name="companyId" className={controlClassName} required>
                <option value="">Choisir…</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                    {company.city ? ` · ${company.city}` : ""}
                  </option>
                ))}
              </select>
              <Button type="submit">Ajouter</Button>
            </form>
          </Card>

          {tour.stops.length === 0 ? (
            <EmptyState
              title="Aucun arrêt"
              description="Ajoutez des entreprises du CRM à visiter aujourd'hui."
            />
          ) : (
            <ol className="space-y-3">
              {tour.stops.map((stop, index) => (
                <li key={stop.id}>
                  <Card className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-meta text-faint">#{stop.order}</p>
                        <Link
                          href={`/entreprises/${stop.company.id}`}
                          className="text-body font-medium text-foreground hover:text-primary"
                        >
                          {stop.company.name}
                        </Link>
                        <div className="mt-2">
                          <LifecycleBadge status={stop.company.lifecycleStatus} />
                        </div>
                        <p className="mt-2 text-meta text-muted">
                          {formatCompanyAddress(stop.company) || "Adresse à compléter"}
                        </p>
                        {stop.visitedAt ? (
                          <p className="mt-1 text-meta text-success">Visité</p>
                        ) : (
                          <p className="mt-1 text-meta text-warning">À visiter</p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <form action={moveTourStopForm}>
                          <input type="hidden" name="companyId" value={stop.company.id} />
                          <input type="hidden" name="direction" value="up" />
                          <Button type="submit" size="sm" variant="secondary" disabled={index === 0}>
                            Monter
                          </Button>
                        </form>
                        <form action={moveTourStopForm}>
                          <input type="hidden" name="companyId" value={stop.company.id} />
                          <input type="hidden" name="direction" value="down" />
                          <Button
                            type="submit"
                            size="sm"
                            variant="secondary"
                            disabled={index === tour.stops.length - 1}
                          >
                            Descendre
                          </Button>
                        </form>
                        <a
                          href={externalItineraryUrl(stop.company)}
                          target="_blank"
                          rel="noreferrer"
                          className={buttonVariants({ variant: "secondary", size: "sm" })}
                        >
                          Itinéraire
                        </a>
                        {!stop.visitedAt ? (
                          <form action={markTourStopVisitedForm}>
                            <input type="hidden" name="companyId" value={stop.company.id} />
                            <Button type="submit" size="sm">
                              Marquer visité
                            </Button>
                          </form>
                        ) : null}
                        <form action={removeCompanyFromTodayTourForm}>
                          <input type="hidden" name="companyId" value={stop.company.id} />
                          <Button type="submit" size="sm" variant="danger">
                            Retirer
                          </Button>
                        </form>
                      </div>
                    </div>
                  </Card>
                </li>
              ))}
            </ol>
          )}
        </>
      ) : (
        <EmptyState
          title="Pas encore de tournée"
          description="Créez la tournée du jour (date civile Europe/Paris) pour y ajouter des entreprises."
        />
      )}
    </div>
  );
}
