import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import { formatMoney } from "@/lib/crm/form-data";
import { loadKanbanBoard } from "@/lib/queries/opportunities";

export const metadata: Metadata = {
  title: "Pipeline",
};

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const board = await loadKanbanBoard();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline"
        description={
          board.openEstimated !== "0.00"
            ? `${formatMoney(board.openEstimated)} estimés sur les étapes ouvertes.`
            : "Les opportunités commerciales, colonne par colonne."
        }
      />
      <PipelineBoard board={board} />
    </div>
  );
}
