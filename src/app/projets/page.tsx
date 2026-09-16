import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectExplorer } from "@/components/projects/project-explorer";
import { listProjects } from "@/lib/queries/projects";

export const metadata: Metadata = {
  title: "Projets",
};

export const dynamic = "force-dynamic";

export default async function ProjetsPage() {
  const projects = await listProjects();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projets"
        description="Suivi de production des projets clients."
      />
      <ProjectExplorer projects={projects} />
    </div>
  );
}
