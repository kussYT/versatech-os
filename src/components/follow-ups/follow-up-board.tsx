import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FollowUpItem } from "@/components/follow-ups/follow-up-item";
import { cn } from "@/lib/cn";
import type { FollowUpBoard, FollowUpBucket } from "@/lib/queries/follow-ups";

const sections: {
  bucket: FollowUpBucket;
  title: string;
  empty: string;
  accent: string;
}[] = [
  {
    bucket: "overdue",
    title: "En retard",
    empty: "Aucune relance en retard.",
    accent: "text-danger",
  },
  {
    bucket: "today",
    title: "Aujourd'hui",
    empty: "Aucune relance prévue aujourd'hui.",
    accent: "text-cyan",
  },
  {
    bucket: "upcoming",
    title: "À venir",
    empty: "Aucune relance à venir.",
    accent: "text-muted",
  },
  {
    bucket: "completed",
    title: "Terminées",
    empty: "Aucune relance terminée.",
    accent: "text-faint",
  },
];

type FollowUpBoardViewProps = {
  board: FollowUpBoard;
};

export function FollowUpBoardView({ board }: FollowUpBoardViewProps) {
  return (
    <div className="space-y-4">
      {sections.map((section) => {
        const items = board[section.bucket];
        return (
          <Card key={section.bucket} className="p-4 sm:p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className={cn("text-section", section.accent)}>{section.title}</h2>
              <p className="text-meta tabular-nums text-muted">{items.length}</p>
            </div>
            {items.length === 0 ? (
              <EmptyState title={section.empty} />
            ) : (
              <div className="mt-4 space-y-2">
                {items.map((followUp) => (
                  <FollowUpItem
                    key={followUp.id}
                    followUp={followUp}
                    bucket={section.bucket}
                  />
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
