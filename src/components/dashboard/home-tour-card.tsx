import Link from "next/link";
import { MapPinned } from "lucide-react";
import { toTourDashboard, type TodayTour } from "@/lib/queries/tours";

type HomeTourCardProps = {
  tour: TodayTour | null;
};

export function HomeTourCard({ tour }: HomeTourCardProps) {
  const dashboard = toTourDashboard(tour);
  if (dashboard.planned === 0 && dashboard.visited === 0 && dashboard.remaining === 0) {
    return null;
  }

  return (
    <section className="glass-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="inline-flex size-9 items-center justify-center rounded-xl bg-primary/12 text-primary">
            <MapPinned className="size-4" aria-hidden="true" strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="text-section text-foreground">Tournée du jour</h2>
            <p className="mt-1 text-body text-muted">
              {dashboard.planned} prévu{dashboard.planned > 1 ? "s" : ""} · {dashboard.visited}{" "}
              visité{dashboard.visited > 1 ? "s" : ""} · {dashboard.remaining} restant
              {dashboard.remaining > 1 ? "s" : ""}
              {dashboard.nextNames.length > 0
                ? ` · Suivants : ${dashboard.nextNames.join(", ")}`
                : ""}
            </p>
          </div>
        </div>
        <Link
          href="/tournee"
          className="text-meta font-medium text-primary hover:text-primary-hover"
        >
          Ouvrir la tournée →
        </Link>
      </div>
    </section>
  );
}
