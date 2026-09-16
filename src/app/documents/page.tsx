import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/layout/section-placeholder";

export const metadata: Metadata = {
  title: "Documents",
};

export default function DocumentsPage() {
  return (
    <SectionPlaceholder
      title="Documents"
      description="Les références de documents apparaîtront ici."
      emptyTitle="Aucun document"
    />
  );
}
