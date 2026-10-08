import type { Metadata } from "next";
import { OperationsBoard } from "@/components/dashboard/operations-board";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { TodayHeader } from "@/components/dashboard/today-header";
import { TodayTourPanel } from "@/components/dashboard/today-tour-panel";
import { requireAuthenticatedUser } from "@/lib/auth/dal";
import { loadPrincipalPrestationLabels } from "@/lib/queries/companies";
import { companyIdsInDashboard } from "@/lib/dashboard/today-rows";
import { loadOperationsDashboard } from "@/lib/queries/operations";
import { TodayService } from "@/lib/services/today";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Aujourd'hui",
};

export default async function TodayPage() {
  const actor = await requireAuthenticatedUser();
  const [overview, operations] = await Promise.all([
    TodayService.getTodayOverview({ actor }),
    loadOperationsDashboard(),
  ]);
  const { taskDashboard, agenda, recentActivity, tourDashboard } = TodayService.toTodayDashboardView(overview);
  const prestations = await loadPrincipalPrestationLabels([
    ...companyIdsInDashboard(operations),
    ...agenda.flatMap((item) => (item.company?.id ? [item.company.id] : [])),
  ]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <TodayHeader />
      <TodayTourPanel dashboard={tourDashboard} />
      <OperationsBoard
        dashboard={operations}
        agenda={agenda}
        tasks={taskDashboard.preview}
        prestations={prestations}
      />
      <details className="rounded-xl border border-border px-4 py-3">
        <summary className="cursor-pointer text-body text-foreground">Activité récente</summary>
        <div className="mt-3">
          <RecentActivity items={recentActivity} />
        </div>
      </details>
    </div>
  );
}
