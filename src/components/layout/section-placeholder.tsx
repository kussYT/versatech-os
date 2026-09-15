import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/page-header";

type SectionPlaceholderProps = {
  title: string;
  description: string;
  emptyTitle: string;
};

export function SectionPlaceholder({
  title,
  description,
  emptyTitle,
}: SectionPlaceholderProps) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <EmptyState title={emptyTitle} />
    </div>
  );
}
