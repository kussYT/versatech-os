import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/layout/section-placeholder";

export const metadata: Metadata = {
  title: "GitHub",
};

export default function GithubPage() {
  return (
    <SectionPlaceholder
      title="GitHub"
      description="L'activité technique liée aux projets apparaîtra ici."
      emptyTitle="Aucune donnée disponible"
    />
  );
}
