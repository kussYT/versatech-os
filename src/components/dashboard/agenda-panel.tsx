import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/crm/form-data";
import { cn } from "@/lib/cn";
import type { AgendaItem } from "@/lib/queries/projects";

type AgendaPanelProps = {
  items: AgendaItem[];
};

export function AgendaPanel({ items }: AgendaPanelProps) {
  return (
    <Card className="card-aurora p-4 sm:p-5">
      <h2 className="text-section text-foreground">Agenda</h2>
      {items.length === 0 ? (
        <EmptyState
          title="Aucun événement aujourd'hui"
          description="Les échéances de tâches, jalons et projets du jour apparaissent ici."
          aside="Votre journée en un coup d'œil."
          asideIcon={CalendarDays}
        />
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className={cn(
                  "block rounded-lg border border-border bg-background/90 px-3 py-2",
                  "motion-safe:transition-[border-color] motion-safe:duration-hover hover:border-primary/40",
                )}
              >
                <p className="text-body font-medium text-foreground">{item.title}</p>
                <p className="mt-1 font-mono text-meta text-faint">
                  {formatDateTime(item.at)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
