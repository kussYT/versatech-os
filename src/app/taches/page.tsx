import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { TaskBoard } from "@/components/projects/task-board";
import { listOpenTasks } from "@/lib/queries/projects";

export const metadata: Metadata = {
  title: "Tâches",
};

export const dynamic = "force-dynamic";

export default async function TachesPage() {
  const tasks = await listOpenTasks();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tâches"
        description="Tâches ouvertes des projets, du retard aux échéances à venir."
        meta={
          tasks.length === 0
            ? "Aucune tâche ouverte"
            : `${tasks.length} tâche${tasks.length > 1 ? "s" : ""} ouverte${tasks.length > 1 ? "s" : ""}`
        }
      />
      <TaskBoard tasks={tasks} />
    </div>
  );
}
