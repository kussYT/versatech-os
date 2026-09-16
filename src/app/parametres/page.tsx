import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/layout/section-placeholder";

export const metadata: Metadata = {
  title: "Paramètres",
};

export default function ParametresPage() {
  return (
    <SectionPlaceholder
      title="Paramètres"
      description="Le profil, les préférences et les intégrations apparaîtront ici."
      emptyTitle="Aucun paramètre à afficher"
    />
  );
}
