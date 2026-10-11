import {
  Banknote,
  FileCheck2,
  FolderPlus,
  UserRoundPlus,
  Activity,
} from "lucide-react";
import { ACTIVITY_LABELS } from "@/lib/crm/activity-labels";
import { formatDateTime } from "@/lib/crm/form-data";
import type { RecentActivityItem } from "@/lib/queries/activity";
import { cn } from "@/lib/cn";

type HomeRecentActivityProps = {
  items: RecentActivityItem[];
};

function iconFor(action: string) {
  if (action.includes("payment") || action.includes("paid")) {
    return { Icon: Banknote, className: "bg-success/15 text-success" };
  }
  if (action.includes("quote") || action.includes("accepted")) {
    return { Icon: FileCheck2, className: "bg-primary/12 text-primary" };
  }
  if (action.includes("project")) {
    return { Icon: FolderPlus, className: "bg-purple/15 text-purple" };
  }
  if (action.includes("contact") || action.includes("company") || action.includes("prospect")) {
    return { Icon: UserRoundPlus, className: "bg-warning/15 text-warning" };
  }
  return { Icon: Activity, className: "bg-surface-high text-muted" };
}

export function HomeRecentActivity({ items }: HomeRecentActivityProps) {
  return (
    <section className="glass-card flex h-full flex-col p-4 sm:p-5">
      <h2 className="text-section text-foreground">Activité récente</h2>

      {items.length === 0 ? (
        <div className="mt-6 flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-white/40 px-3 py-8 text-center">
          <p className="text-body font-medium text-foreground">Aucune activité</p>
          <p className="mt-1 text-meta text-muted">
            Les devis, paiements et créations récentes apparaîtront ici.
          </p>
        </div>
      ) : (
        <ol className="mt-4 flex-1 space-y-3">
          {items.map((item) => {
            const { Icon, className } = iconFor(item.action);
            return (
              <li key={item.id} className="flex items-start gap-3">
                <span
                  className={cn(
                    "inline-flex size-8 shrink-0 items-center justify-center rounded-xl",
                    className,
                  )}
                >
                  <Icon className="size-3.5" aria-hidden="true" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-body text-foreground">
                    {ACTIVITY_LABELS[item.action] ?? item.action}
                  </p>
                  {item.actorName ? (
                    <p className="mt-0.5 text-meta text-muted">{item.actorName}</p>
                  ) : null}
                </div>
                <p className="shrink-0 text-meta text-faint">{formatDateTime(item.createdAt)}</p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
