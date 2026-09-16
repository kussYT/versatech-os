import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjectHub } from "@/components/projects/project-hub";
import { getGitHubProjectSnapshot } from "@/lib/queries/github";
import { listPaymentFormOptions } from "@/lib/queries/payments";
import { getProjectDetail } from "@/lib/queries/projects";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/projets/[id]">): Promise<Metadata> {
  const { id } = await params;
  const project = await getProjectDetail(id);
  return { title: project?.name ?? "Projet" };
}

export default async function ProjectPage({
  params,
}: PageProps<"/projets/[id]">) {
  const { id } = await params;
  const project = await getProjectDetail(id);

  if (!project) {
    notFound();
  }

  const [github, paymentOptions] = await Promise.all([
    getGitHubProjectSnapshot(project.repositories),
    listPaymentFormOptions({ companyId: project.company.id, projectId: project.id }),
  ]);

  return <ProjectHub project={project} github={github} paymentOptions={paymentOptions} />;
}
