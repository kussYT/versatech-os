"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FollowUpItem } from "@/components/follow-ups/follow-up-item";
import type { FollowUpBoard, FollowUpBucket } from "@/lib/queries/follow-ups";

const sections: {
  bucket: FollowUpBucket;
  title: string;
  empty: string;
}[] = [
  {
    bucket: "overdue",
    title: "En retard",
    empty: "Aucune relance en retard.",
  },
  {
    bucket: "today",
    title: "Aujourd'hui",
    empty: "Aucune relance prévue aujourd'hui.",
  },
  {
    bucket: "upcoming",
    title: "À venir",
    empty: "Aucune relance à venir.",
  },
  {
    bucket: "completed",
    title: "Terminées",
    empty: "Aucune relance terminée.",
  },
];

type FollowUpBoardViewProps = {
  board: FollowUpBoard;
};

export function FollowUpBoardView({ board }: FollowUpBoardViewProps) {
  const [bucket, setBucket] = useState<FollowUpBucket>(
    () => sections.find((item) => board[item.bucket].length > 0)?.bucket ?? "today",
  );
  const section = sections.find((item) => item.bucket === bucket) ?? sections[0]!;
  const items = board[section.bucket];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer les relances">
        {sections.map((item) => (
          <Button
            key={item.bucket}
            variant={bucket === item.bucket ? "primary" : "secondary"}
            aria-pressed={bucket === item.bucket}
            onClick={() => setBucket(item.bucket)}
          >
            {item.title} ({board[item.bucket].length})
          </Button>
        ))}
      </div>
      {items.length === 0 ? (
        <EmptyState title={section.empty} />
      ) : (
        <div className="space-y-2">
          {items.map((followUp) => (
            <FollowUpItem key={followUp.id} followUp={followUp} bucket={section.bucket} />
          ))}
        </div>
      )}
    </div>
  );
}
