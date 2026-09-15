import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/layout/section-placeholder";

export const metadata: Metadata = {
  title: "Prospection",
};

export default function ProspectionPage() {
  return (
    <SectionPlaceholder
      title="Prospection"
      description="La file « À contacter aujourd'hui » et les actions d'appel apparaîtront ici."
      emptyTitle="Aucune donnée disponible"
    />
  );
}
