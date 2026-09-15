import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/layout/section-placeholder";

export const metadata: Metadata = {
  title: "Relances",
};

export default function RelancesPage() {
  return (
    <SectionPlaceholder
      title="Relances"
      description="Les relances échues, du jour et à venir apparaîtront ici."
      emptyTitle="0 relance"
    />
  );
}
