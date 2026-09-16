import type { Metadata } from "next";
import { AgendaPanel } from "@/components/dashboard/agenda-panel";
import { CallsFollowups } from "@/components/dashboard/calls-followups";
import { KpiZone } from "@/components/dashboard/kpi-zone";
import { PipelinePreview } from "@/components/dashboard/pipeline-preview";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { TasksPanel } from "@/components/dashboard/tasks-panel";
import { TodayHeader } from "@/components/dashboard/today-header";
import { getTodayAgenda } from "@/lib/queries/calendar";
import { getRecentActivity, getTodayInteractionCounts } from "@/lib/queries/activity";
import { listCompaniesToCall } from "@/lib/queries/companies";
import { getFollowUpDashboard } from "@/lib/queries/follow-ups";
import { getPipelineOverview } from "@/lib/queries/opportunities";
import { getTaskDashboard } from "@/lib/queries/projects";
import { getSignedRevenue } from "@/lib/queries/quotes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Aujourd'hui",
};

export default async function TodayPage() {
  const [
    pipelineOverview,
    followUps,
    signedRevenue,
    taskDashboard,
    agenda,
    calls,
    interactionCounts,
    recentActivity,
  ] = await Promise.all([
    getPipelineOverview(),
    getFollowUpDashboard(),
    getSignedRevenue(),
    getTaskDashboard(),
    getTodayAgenda(),
    listCompaniesToCall(),
    getTodayInteractionCounts(),
    getRecentActivity(),
  ]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <TodayHeader />
      <KpiZone
        pipelineBrut={pipelineOverview.brutTotal}
        pipelineWeighted={pipelineOverview.weightedTotal}
        dueFollowUps={followUps.dueCount}
        signedRevenue={signedRevenue}
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
