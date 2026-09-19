import type { Metadata } from "next";
import { AgendaPanel } from "@/components/dashboard/agenda-panel";
import { CallsFollowups } from "@/components/dashboard/calls-followups";
import { KpiZone } from "@/components/dashboard/kpi-zone";
import { PipelinePreview } from "@/components/dashboard/pipeline-preview";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { TasksPanel } from "@/components/dashboard/tasks-panel";
import { TodayHeader } from "@/components/dashboard/today-header";
import { TodayTourPanel } from "@/components/dashboard/today-tour-panel";
import { requireAuthenticatedUser } from "@/lib/auth/dal";
import { TodayService } from "@/lib/services/today";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Aujourd'hui",
};

export default async function TodayPage() {
  const actor = await requireAuthenticatedUser();
  const overview = await TodayService.getTodayOverview({ actor });
  const {
    pipelineOverview,
    followUps,
    finance,
    taskDashboard,
    agenda,
    calls,
    interactionCounts,
    recentActivity,
    tourDashboard,
  } = TodayService.toTodayDashboardView(overview);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <TodayHeader />
      <TodayTourPanel dashboard={tourDashboard} />
      <KpiZone
        pipelineBrut={pipelineOverview.brutTotal}
        pipelineWeighted={pipelineOverview.weightedTotal}
        dueFollowUps={followUps.dueCount}
        signedRevenue={finance.signed}
        collectedRevenue={finance.collected}
        remainingRevenue={finance.remaining}
        overduePayments={finance.overdueCount}
        openTasks={taskDashboard.openCount}
        callsToday={interactionCounts.calls}
        meetingsToday={interactionCounts.meetings}
      />
      <CallsFollowups calls={calls} followUps={followUps.preview} />
      <div className="grid gap-3 lg:grid-cols-2">
        <TasksPanel tasks={taskDashboard.preview} />
        <AgendaPanel items={agenda} />
      </div>
      <PipelinePreview overview={pipelineOverview} />
      <RecentActivity items={recentActivity} />
    </div>
  );
}
