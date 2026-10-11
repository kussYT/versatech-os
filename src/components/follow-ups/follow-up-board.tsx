"use client";

import { useState } from "react";
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
      <div
        className="flex flex-wrap gap-1.5 rounded-[1.25rem] border border-white/70 bg-white/40 p-1.5 backdrop-blur-sm"
        role="group"
        aria-label="Filtrer les relances"
      >
        {sections.map((item) => {
          const active = bucket === item.bucket;
          const overdue = item.bucket === "overdue" && board[item.bucket].length > 0;
          return (
            <button
              key={item.bucket}
              type="button"
              aria-pressed={active}
              onClick={() => setBucket(item.bucket)}
              className={
                active
                  ? overdue
                    ? "rounded-full bg-red-50 px-3.5 py-2 text-meta font-medium text-red-700 shadow-[0_1px_3px_rgb(31_41_80/0.08)]"
                    : "rounded-full bg-white/85 px-3.5 py-2 text-meta font-medium text-foreground shadow-[0_1px_3px_rgb(31_41_80/0.08)]"
                  : overdue
                    ? "rounded-full px-3.5 py-2 text-meta text-red-600 transition-colors hover:bg-white/50"
                    : "rounded-full px-3.5 py-2 text-meta text-muted transition-colors hover:bg-white/50 hover:text-foreground"
              }
            >
              {item.title} ({board[item.bucket].length})
            </button>
          );
        })}
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
