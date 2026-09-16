import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/layout/section-placeholder";

export const metadata: Metadata = {
  title: "Analytics",
};

export default function AnalyticsPage() {
  return (
    <SectionPlaceholder
      title="Analytics"
      description="Les indicateurs calculés depuis les données persistées apparaîtront ici."
      emptyTitle="Aucune donnée disponible"
    />
  );
}
