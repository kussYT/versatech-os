import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/layout/section-placeholder";

export const metadata: Metadata = {
  title: "Devis",
};

export default function DevisPage() {
  return (
    <SectionPlaceholder
      title="Devis"
      description="Les devis et leur suivi apparaîtront ici."
      emptyTitle="Aucun devis"
    />
  );
}
