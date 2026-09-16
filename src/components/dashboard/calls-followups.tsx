import { Clock, Phone } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/crm/form-data";
import { cn } from "@/lib/cn";
import type { CompanyListItem } from "@/lib/queries/companies";
import type { FollowUpListItem } from "@/lib/queries/follow-ups";

type CallsFollowupsProps = {
  calls: CompanyListItem[];
  followUps: FollowUpListItem[];
};

export function CallsFollowups({ calls, followUps }: CallsFollowupsProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Card className="card-aurora p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-section text-foreground">Appels</h2>
          <Link href="/prospection" className="text-meta text-primary hover:text-primary-hover">
            Voir la file
          </Link>
        </div>
        {calls.length === 0 ? (
          <EmptyState
            title="Aucun lead à contacter"
            description="Les entreprises au statut Lead apparaîtront ici."
            aside="Restez proche de vos opportunités."
            asideIcon={Phone}
          />
        ) : (
          <ul className="mt-4 space-y-2">
            {calls.map((company) => (
              <li key={company.id}>
                <Link
                  href={`/entreprises/${company.id}`}
                  className={cn(
                    "block rounded-lg border border-border bg-background/90 px-3 py-2",
                    "motion-safe:transition-[border-color] motion-safe:duration-hover hover:border-primary/40",
                  )}
                >
                  <p className="text-body font-medium text-foreground">{company.name}</p>
                  <p className="mt-0.5 text-meta text-muted">
                    {[company.industry, company.city].filter(Boolean).join(" · ") || "Lead"}
                  </p>
                  {company.primaryContact ? (
                    <p className="mt-1 text-meta text-faint">
                      {company.primaryContact.firstName} {company.primaryContact.lastName}
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card className="card-aurora p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-section text-foreground">Relances</h2>
          <Link href="/relances" className="text-meta text-primary hover:text-primary-hover">
            Voir toutes
          </Link>
        </div>
        {followUps.length === 0 ? (
          <EmptyState
            title="0 relance"
            description="Les relances échues et à venir apparaîtront ici."
            aside="Ne laissez aucune opportunité en attente."
            asideIcon={Clock}
          />
        ) : (
          <ul className="mt-4 space-y-2">
            {followUps.map((followUp) => (
              <li key={followUp.id}>
                <Link
                  href={`/entreprises/${followUp.company.id}`}
                  className={cn(
                    "block rounded-lg border border-border bg-background/90 px-3 py-2",
                    "motion-safe:transition-[border-color] motion-safe:duration-hover hover:border-primary/40",
                  )}
                >
                  <p className="text-body font-medium text-foreground">
                    {followUp.company.name}
                  </p>
                  <p className="mt-0.5 text-meta text-muted">{followUp.title}</p>
                  <p className="mt-1 font-mono text-meta text-faint">
                    {formatDateTime(followUp.dueAt)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
