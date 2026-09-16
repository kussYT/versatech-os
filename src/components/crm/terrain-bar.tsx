"use client";

import { useActionState } from "react";
import Link from "next/link";
import { markCompanyVisited } from "@/actions/visit";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LifecycleBadge } from "@/components/ui/lifecycle-badge";
import { idleActionResult } from "@/lib/crm/action-result";
import { externalItineraryUrl, formatCompanyAddress } from "@/lib/prospection/itinerary";
import { prospectionTourIntent } from "@/lib/prospection/tour-intent";
import type { CommercialBrief } from "@/lib/prospection/brief";
import type { CompanyDetail } from "@/lib/queries/companies";

type TerrainBarProps = {
  company: CompanyDetail;
  brief: CommercialBrief;
  onCall: () => void;
  onInteraction: () => void;
  onFollowUp: () => void;
  onOpportunity: () => void;
};

export function TerrainBar({
  company,
  brief,
  onCall,
  onInteraction,
  onFollowUp,
  onOpportunity,
}: TerrainBarProps) {
  const [visitState, visitAction, visitPending] = useActionState(
    markCompanyVisited,
    idleActionResult,
  );
  const address = formatCompanyAddress(company);
  const itinerary = externalItineraryUrl(company);
  const tour = prospectionTourIntent(company.id);

  return (
    <Card className="p-4 lg:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-h2 text-foreground">{company.name}</h2>
        <LifecycleBadge status={company.lifecycleStatus} />
      </div>
      <p className="mt-2 text-body text-muted">{address || "Adresse à compléter"}</p>
      {company.phone ? (
        <a href={`tel:${company.phone}`} className="mt-1 inline-block text-body text-primary hover:text-primary-hover">
          {company.phone}
        </a>
      ) : (
        <p className="mt-1 text-meta text-faint">Téléphone à compléter</p>
      )}
      {brief.angle ? (
        <p className="mt-3 text-body text-foreground">
          <span className="text-meta text-faint uppercase">Pitch · </span>
          {brief.angle}
        </p>
      ) : null}
      {brief.opportunities ? (
        <p className="mt-2 text-body text-muted">
          <span className="text-meta text-faint uppercase">Opportunités · </span>
          {brief.opportunities}
        </p>
      ) : null}

      {visitState.message && !visitState.ok ? (
        <p className="mt-3 text-meta text-danger">{visitState.message}</p>
      ) : null}
      {visitState.ok ? (
        <p className="mt-3 text-meta text-success">Visite terrain enregistrée.</p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={onCall} disabled={!company.phone}>
          Appeler
        </Button>
        <Button size="sm" variant="secondary" onClick={onInteraction}>
          Ajouter interaction
        </Button>
        <form action={visitAction}>
          <input type="hidden" name="companyId" value={company.id} />
          <Button type="submit" size="sm" variant="secondary" disabled={visitPending}>
            {visitPending ? "Enregistrement…" : "Marquer visité"}
          </Button>
        </form>
        <Button size="sm" variant="secondary" onClick={onFollowUp}>
          Planifier relance
        </Button>
        <Button size="sm" variant="secondary" onClick={onOpportunity}>
          Créer une opportunité
        </Button>
        <a
          href={itinerary}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({ variant: "secondary", size: "sm" })}
        >
          Itinéraire
        </a>
        <Link href={tour.href} className={buttonVariants({ variant: "ghost", size: "sm" })}>
          {tour.label}
        </Link>
      </div>
    </Card>
  );
}
