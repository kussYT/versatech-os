import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import { formatMoney } from "@/lib/crm/form-data";
import { listPipelineBoard } from "@/lib/queries/opportunities";

export const metadata: Metadata = {
  title: "Pipeline",
};

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const columns = await listPipelineBoard();
  const openColumns = columns.filter(
    (column) => column.stage !== "WON" && column.stage !== "LOST",
  );
  const brutTotal = openColumns.reduce((sum, column) => sum + column.estimatedTotal, 0);
  const weightedTotal = openColumns.reduce((sum, column) => sum + column.weightedTotal, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline"
        description={
          brutTotal > 0
            ? `Brut ${formatMoney(brutTotal)} · pondéré ${formatMoney(weightedTotal)}. Les probabilités suivent le stage (saisie manuelle possible à la création).`
            : "Les opportunités commerciales, colonne par colonne."
        }
      />
      <PipelineBoard columns={columns} />
    </div>
  );
}
