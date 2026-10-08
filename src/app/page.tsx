import type { Metadata } from "next";
import { AgendaPanel } from "@/components/dashboard/agenda-panel";
import { OperationsBoard } from "@/components/dashboard/operations-board";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { TasksPanel } from "@/components/dashboard/tasks-panel";
import { TodayHeader } from "@/components/dashboard/today-header";
import { TodayTourPanel } from "@/components/dashboard/today-tour-panel";
import { requireAuthenticatedUser } from "@/lib/auth/dal";
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

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <TodayHeader />
      <TodayTourPanel dashboard={tourDashboard} />
      <OperationsBoard dashboard={operations} />
      <div className="grid gap-3 lg:grid-cols-2">
        <TasksPanel tasks={taskDashboard.preview} />
        <AgendaPanel items={agenda} />
      </div>
      <RecentActivity items={recentActivity} />
    </div>
  );
}
