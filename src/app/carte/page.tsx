import type { Metadata } from "next";
import { CarteView } from "@/components/map/carte-view";
import { PageHeader } from "@/components/layout/page-header";
import { isNominatimConfigured } from "@/lib/prospection/geocode";
import { getTodayVisitCompanyIds } from "@/lib/prospection/today-visits";
import { listMapCompanies } from "@/lib/queries/map";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Carte",
};

export default async function CartePage() {
  const [companies, todayVisitIds] = await Promise.all([
    listMapCompanies(),
    getTodayVisitCompanyIds(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        meta="Prospection terrain"
        title="Carte"
        description="Entreprises du CRM positionnées sur OpenStreetMap. Aucune coordonnée inventée."
      />
      <CarteView
        companies={companies}
        todayVisitIds={todayVisitIds}
        geocoderConfigured={isNominatimConfigured()}
      />
    </div>
  );
}
