import type { Metadata } from "next";
import { AgendaPanel } from "@/components/dashboard/agenda-panel";
import { CallsFollowups } from "@/components/dashboard/calls-followups";
import { KpiZone } from "@/components/dashboard/kpi-zone";
import { PipelinePreview } from "@/components/dashboard/pipeline-preview";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { TasksPanel } from "@/components/dashboard/tasks-panel";
import { TodayHeader } from "@/components/dashboard/today-header";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Aujourd'hui",
};

export default function TodayPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <TodayHeader />
      <KpiZone />
      <CallsFollowups />
      <div className="grid gap-3 lg:grid-cols-2">
        <TasksPanel />
        <AgendaPanel />
      </div>
      <PipelinePreview />
      <RecentActivity />
    </div>
  );
}
