import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { FollowUpBoardView } from "@/components/follow-ups/follow-up-board";
import { listFollowUpBoard } from "@/lib/queries/follow-ups";

export const metadata: Metadata = {
  title: "Relances",
};

export const dynamic = "force-dynamic";

export default async function RelancesPage() {
  const board = await listFollowUpBoard();
  const openCount =
    board.overdue.length + board.today.length + board.upcoming.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relances"
        description="Qui relancer, quand, et pourquoi — du retard aux actions à venir."
        meta={
          openCount === 0
            ? "Aucune relance ouverte"
            : `${openCount} relance${openCount > 1 ? "s" : ""} ouverte${openCount > 1 ? "s" : ""}`
        }
      />
      <FollowUpBoardView board={board} />
    </div>
  );
}
