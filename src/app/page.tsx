import type { Metadata } from "next";
import { AgendaPanel } from "@/components/dashboard/agenda-panel";
import { CallsFollowups } from "@/components/dashboard/calls-followups";
import { KpiZone } from "@/components/dashboard/kpi-zone";
import { PipelinePreview } from "@/components/dashboard/pipeline-preview";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { TasksPanel } from "@/components/dashboard/tasks-panel";
import { TodayHeader } from "@/components/dashboard/today-header";
import { getPipelineOverview } from "@/lib/queries/opportunities";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Aujourd'hui",
};

export default async function TodayPage() {
  const pipelineOverview = await getPipelineOverview();

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <TodayHeader />
      <KpiZone pipelineBrut={pipelineOverview.brutTotal} />
      <CallsFollowups />
      <div className="grid gap-3 lg:grid-cols-2">
        <TasksPanel />
        <AgendaPanel />
      </div>
      <PipelinePreview overview={pipelineOverview} />
      <RecentActivity />
    </div>
  );
}
