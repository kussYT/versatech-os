import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/layout/section-placeholder";

export const metadata: Metadata = {
  title: "Calendrier",
};

export default function CalendrierPage() {
  return (
    <SectionPlaceholder
      title="Calendrier"
      description="Les vues mois, semaine et jour apparaîtront ici."
      emptyTitle="Aucun événement"
    />
  );
}
