import Link from "next/link";
import type { TourDashboard } from "@/lib/queries/tours";

export function TodayTourPanel({ dashboard }: { dashboard: TourDashboard }) {
  if (dashboard.planned === 0 && dashboard.visited === 0 && dashboard.remaining === 0) {
    return null;
  }

  return (
    <p className="text-body text-foreground">
      Tournée : {dashboard.planned} prévu{dashboard.planned > 1 ? "s" : ""} · {dashboard.visited}{" "}
      visité{dashboard.visited > 1 ? "s" : ""} · {dashboard.remaining} restant
      {dashboard.remaining > 1 ? "s" : ""}
      {dashboard.nextNames.length > 0 ? ` · Suivants : ${dashboard.nextNames.join(", ")}` : ""}
      {" · "}
      <Link href="/tournee" className="font-medium text-primary hover:text-primary-hover">
        Ouvrir
      </Link>
    </p>
  );
}
