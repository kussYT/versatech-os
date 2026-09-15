import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/layout/section-placeholder";

export const metadata: Metadata = {
  title: "Tâches",
};

export default function TachesPage() {
  return (
    <SectionPlaceholder
      title="Tâches"
      description="Les vues Aujourd'hui, Cette semaine et En retard apparaîtront ici."
      emptyTitle="Aucune tâche"
    />
  );
}
