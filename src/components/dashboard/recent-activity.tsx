import { Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ACTIVITY_LABELS } from "@/lib/crm/activity-labels";
import { formatDateTime } from "@/lib/crm/form-data";
import type { RecentActivityItem } from "@/lib/queries/activity";

type RecentActivityProps = {
  items: RecentActivityItem[];
};

export function RecentActivity({ items }: RecentActivityProps) {
  return (
    <Card className="card-aurora p-4 sm:p-5">
      <h2 className="text-section text-foreground">Activité récente</h2>
      {items.length === 0 ? (
        <EmptyState
          title="Aucune activité"
          description="L'historique des interactions, notes et changements de statut apparaîtra ici."
          aside="Toute votre activité au même endroit."
          asideIcon={Activity}
        />
      ) : (
        <ol className="mt-4 space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-border bg-background/90 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-body text-foreground">
                  {ACTIVITY_LABELS[item.action] ?? item.action}
                </p>
                {item.actorName ? (
                  <p className="mt-0.5 text-meta text-muted">{item.actorName}</p>
                ) : null}
              </div>
              <p className="font-mono text-meta text-faint">{formatDateTime(item.createdAt)}</p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
