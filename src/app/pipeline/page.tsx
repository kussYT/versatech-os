import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/layout/section-placeholder";

export const metadata: Metadata = {
  title: "Pipeline",
};

export default function PipelinePage() {
  return (
    <SectionPlaceholder
      title="Pipeline"
      description="Le Kanban des opportunités apparaîtra ici."
      emptyTitle="Le pipeline apparaîtra ici"
    />
  );
}
