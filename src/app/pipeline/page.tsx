import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import { listPipelineBoard } from "@/lib/queries/opportunities";

export const metadata: Metadata = {
  title: "Pipeline",
};

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const columns = await listPipelineBoard();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline"
        description="Les opportunités commerciales, colonne par colonne."
      />
      <PipelineBoard columns={columns} />
    </div>
  );
}
