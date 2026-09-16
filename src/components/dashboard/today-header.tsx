import { PageHeader } from "@/components/layout/page-header";

export function TodayHeader() {
  const now = new Date();
  const dateLabel = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(now);

  return (
    <PageHeader
      meta={dateLabel}
      title="Aujourd'hui"
      description="Les priorités du jour apparaîtront ici."
    />
  );
}
