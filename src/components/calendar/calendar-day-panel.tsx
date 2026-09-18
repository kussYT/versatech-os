import Link from "next/link";
import { CalendarKindBadge } from "@/components/calendar/calendar-kind-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDayTitle, formatTime } from "@/lib/calendar/dates";
import { calendarItemLabel } from "@/lib/calendar/labels";
import type { CalendarItem } from "@/lib/calendar/types";
import { formatDateTime } from "@/lib/crm/form-data";
import { cn } from "@/lib/cn";

type CalendarDayPanelProps = {
  dateKey: string;
  items: CalendarItem[];
  selectedId: string | null;
  onSelect: (item: CalendarItem) => void;
  onEdit: (item: CalendarItem) => void;
  emptyTitle: string;
  emptyDescription?: string;
};

export function CalendarDayPanel({
  dateKey,
  items,
  selectedId,
  onSelect,
  onEdit,
  emptyTitle,
  emptyDescription,
}: CalendarDayPanelProps) {
  if (items.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <ul className="space-y-2">
      {items.map((entry) => {
        const selected = selectedId === entry.id;
        return (
          <li key={entry.id}>
            <article
              className={cn(
                "rounded-xl border border-border bg-background/90 p-3",
                "motion-safe:transition-[border-color] motion-safe:duration-hover",
                selected && "border-primary/50",
                entry.overdue && "border-danger/40",
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(entry)}
                className="w-full text-left"
                aria-expanded={selected}
                aria-label={`${calendarItemLabel(entry)} · ${entry.title}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-body font-medium text-foreground">{entry.title}</p>
                  <CalendarKindBadge item={entry} />
                </div>
                <p className={cn("mt-1 font-mono text-meta", entry.overdue ? "text-danger" : "text-faint")}>
                  {entry.allDay ? "Journée entière" : formatTime(entry.startsAt)}
                  {!entry.allDay && entry.endsAt !== entry.startsAt
                    ? ` – ${formatTime(entry.endsAt)}`
                    : null}
                </p>
              </button>

              {selected ? (
                <div className="mt-3 space-y-2 border-t border-border pt-3">
                  <p className="text-meta text-muted">
                    {formatDateTime(entry.startsAt)}
                    {entry.allDay ? "" : ` · ${formatDayTitle(dateKey)}`}
                  </p>
                  {entry.company ? (
                    <Link
                      href={`/entreprises/${entry.company.id}`}
                      className="block text-meta text-primary hover:text-primary-hover"
                    >
                      Entreprise · {entry.company.name}
                    </Link>
                  ) : null}
                  {entry.kind === "terrain_visit" ? (
                    <p className="text-meta text-muted">
                      Ordre {entry.visitOrder ?? "—"} ·{" "}
                      {entry.visitStatus === "visited" ? "Visitée" : "À visiter"}
                    </p>
                  ) : null}
                  {entry.project ? (
                    <Link
                      href={`/projets/${entry.project.id}`}
                      className="block text-meta text-primary hover:text-primary-hover"
                    >
                      Projet · {entry.project.name}
                    </Link>
                  ) : null}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {entry.href ? (
                      <Link href={entry.href} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                        Ouvrir
                      </Link>
                    ) : null}
                    {entry.secondaryHref ? (
                      <Link
                        href={entry.secondaryHref}
                        className={buttonVariants({ variant: "secondary", size: "sm" })}
                      >
                        Tournée
                      </Link>
                    ) : null}
                    {entry.editable ? (
                      <Button size="sm" onClick={() => onEdit(entry)}>
                        Modifier
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </article>
          </li>
        );
      })}
    </ul>
  );
}
