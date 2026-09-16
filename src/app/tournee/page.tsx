import type { Metadata } from "next";
import { TourView } from "@/components/tour/tour-view";
import { PageHeader } from "@/components/layout/page-header";
import { getTodayTour, listCompaniesForTourPicker } from "@/lib/queries/tours";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tournée",
};

export default async function TourneePage({
  searchParams,
}: {
  searchParams: Promise<{ add?: string | string[] }>;
}) {
  const params = await searchParams;
  const addRaw = params.add;
  const addCompanyId = typeof addRaw === "string" ? addRaw : undefined;
  const [tour, companies] = await Promise.all([
    getTodayTour(),
    listCompaniesForTourPicker(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        meta="Prospection terrain"
        title="Tournée du jour"
        description="Ordre de visite des entreprises du CRM pour le jour civil Europe/Paris."
      />
      <TourView tour={tour} companies={companies} addCompanyId={addCompanyId} />
    </div>
  );
}
