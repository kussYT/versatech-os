import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/layout/section-placeholder";

export const metadata: Metadata = {
  title: "Finances",
};

export default function FinancesPage() {
  return (
    <SectionPlaceholder
      title="Finances"
      description="Le pilotage CA, pipeline et MRR apparaîtra ici."
      emptyTitle="Aucune donnée disponible"
    />
  );
}
