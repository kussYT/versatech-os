import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/layout/section-placeholder";

export const metadata: Metadata = {
  title: "Entreprises",
};

export default function EntreprisesPage() {
  return (
    <SectionPlaceholder
      title="Entreprises"
      description="Le répertoire des entreprises et leurs fiches apparaîtront ici."
      emptyTitle="Aucune entreprise"
    />
  );
}
