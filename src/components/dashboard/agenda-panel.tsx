import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { CalendarKindBadge } from "@/components/calendar/calendar-kind-badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatTime } from "@/lib/calendar/dates";
import type { CalendarItem } from "@/lib/calendar/types";
import { formatDate } from "@/lib/crm/form-data";
import { cn } from "@/lib/cn";

type AgendaPanelProps = {
  items: CalendarItem[];
};

export function AgendaPanel({ items }: AgendaPanelProps) {
  return (
    <Card className="card-aurora p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-section text-foreground">Agenda</h2>
        <Link href="/calendrier" className="text-meta text-primary hover:text-primary-hover">
          Voir le calendrier
        </Link>
      </div>
      {items.length === 0 ? (
        <EmptyState
          title="Aucun événement aujourd'hui"
          description="Les RDV, relances, tâches, jalons et deadlines du jour apparaissent ici."
          aside="Votre journée en un coup d'œil."
          asideIcon={CalendarDays}
        />
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href ?? "/calendrier"}
                className={cn(
                  "block rounded-lg border border-border bg-background/90 px-3 py-2",
                  "motion-safe:transition-[border-color] motion-safe:duration-hover hover:border-primary/40",
                  item.overdue && "border-danger/40",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-body font-medium text-foreground">{item.title}</p>
                  <CalendarKindBadge item={item} />
                </div>
                {item.company ? (
                  <p className="mt-0.5 text-meta text-muted">{item.company.name}</p>
                ) : item.project ? (
                  <p className="mt-0.5 text-meta text-muted">{item.project.name}</p>
                ) : null}
                <p className="mt-1 font-mono text-meta text-faint">
                  {item.allDay ? formatDate(item.startsAt) : formatTime(item.startsAt)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
