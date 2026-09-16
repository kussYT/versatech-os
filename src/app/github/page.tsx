import type { Metadata } from "next";
import { GithubOverview } from "@/components/github/github-overview";
import { PageHeader } from "@/components/layout/page-header";
import { getGitHubOverview } from "@/lib/queries/github";

export const metadata: Metadata = {
  title: "GitHub",
};

export const dynamic = "force-dynamic";

export default async function GithubPage() {
  const overview = await getGitHubOverview();

  return (
    <div className="space-y-6">
      <PageHeader
        title="GitHub"
        description="Repositories associés aux projets, en lecture seule."
      />
      <GithubOverview overview={overview} />
    </div>
  );
}
