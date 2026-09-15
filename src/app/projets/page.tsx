import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/layout/section-placeholder";

export const metadata: Metadata = {
  title: "Projets",
};

export default function ProjetsPage() {
  return (
    <SectionPlaceholder
      title="Projets"
      description="Le suivi des projets clients apparaîtra ici."
      emptyTitle="Aucun projet"
    />
  );
}
