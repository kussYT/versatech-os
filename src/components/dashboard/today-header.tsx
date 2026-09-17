import { PageHeader } from "@/components/layout/page-header";
import { formatLongDate } from "@/lib/dates";

export function TodayHeader() {
  return (
    <PageHeader
      meta={formatLongDate()}
      title="Aujourd'hui"
      description="Les priorités du jour apparaîtront ici."
    />
  );
}
