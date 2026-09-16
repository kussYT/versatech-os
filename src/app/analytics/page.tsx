import type { Metadata } from "next";
import { AnalyticsView } from "@/components/analytics/analytics-view";
import { PeriodSwitcher } from "@/components/analytics/period-switcher";
import { PageHeader } from "@/components/layout/page-header";
import { parseAnalyticsPeriod } from "@/lib/dates";
import { getAnalyticsReport } from "@/lib/queries/analytics";

export const metadata: Metadata = {
  title: "Analytics",
};

export const dynamic = "force-dynamic";

function firstString(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

export default async function AnalyticsPage({
  searchParams,
}: PageProps<"/analytics">) {
  const params = await searchParams;
  const period = parseAnalyticsPeriod(firstString(params.periode));
  const report = await getAnalyticsReport(period);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Analytics"
        description="Indicateurs calculés depuis les données persistées. Aucune écriture métier."
        actions={<PeriodSwitcher period={period} />}
      />
      <AnalyticsView report={report} />
    </div>
  );
}
