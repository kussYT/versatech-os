import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { TourDashboard } from "@/lib/queries/tours";

export function TodayTourPanel({ dashboard }: { dashboard: TourDashboard }) {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-meta font-medium tracking-[0.1em] text-muted uppercase">
            Prospection du jour
          </p>
          <p className="mt-2 text-body text-foreground">
            {dashboard.planned} prévu{dashboard.planned > 1 ? "s" : ""} · {dashboard.visited}{" "}
            visité{dashboard.visited > 1 ? "s" : ""} · {dashboard.remaining} restant
            {dashboard.remaining > 1 ? "s" : ""}
          </p>
          <p className="mt-1 text-meta text-muted">
            {dashboard.nextNames.length > 0
              ? `Suivants : ${dashboard.nextNames.join(" · ")}`
              : "Aucun prospect restant"}
          </p>
        </div>
        <Link href="/tournee" className="text-meta font-medium text-primary hover:text-primary-hover">
          Ouvrir ma tournée
        </Link>
      </div>
    </Card>
  );
}
