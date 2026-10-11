import Link from "next/link";
import { MapPin, Phone, Video } from "lucide-react";
import { formatDate } from "@/lib/crm/form-data";
import { formatTime, parisDateKey, startOfToday } from "@/lib/dates";
import type { DashboardAgendaItem } from "@/lib/queries/dashboard-home";
import { cn } from "@/lib/cn";

type HomeCalendarCardProps = {
  items: DashboardAgendaItem[];
  now?: Date;
};

function kindDot(kind: DashboardAgendaItem["kind"]) {
  if (kind === "event") return "bg-primary";
  if (kind === "follow_up") return "bg-warning";
  if (kind === "task") return "bg-purple";
  return "bg-cyan";
}

function kindMeta(item: DashboardAgendaItem) {
  if (item.allDay) return "Journée";
  if (item.kind === "follow_up") return "Relance";
  if (item.kind === "task") return "Tâche";
  if (item.kind === "milestone") return "Jalons";
  return "RDV";
}

export function HomeCalendarCard({ items, now = new Date() }: HomeCalendarCardProps) {
  const todayKey = parisDateKey(startOfToday(now));

  return (
    <section className="glass-card flex h-full flex-col p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-section text-foreground">Mon calendrier</h2>
        <Link
          href="/calendrier"
          className="text-meta font-medium text-primary hover:text-primary-hover"
        >
          Voir tout →
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="mt-6 flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-white/40 px-3 py-8 text-center">
          <p className="text-body font-medium text-foreground">Aucun événement à venir</p>
          <p className="mt-1 text-meta text-muted">Les prochains rendez-vous apparaîtront ici.</p>
        </div>
      ) : (
        <ol className="mt-4 flex-1 space-y-3">
          {items.map((item) => {
            const dayKey = parisDateKey(item.startsAt);
            const timeLabel = item.allDay
              ? dayKey === todayKey
                ? "Aujourd'hui"
                : formatDate(item.startsAt)
              : formatTime(item.startsAt);
            return (
              <li key={`${item.kind}-${item.id}`}>
                <Link
                  href={item.href ?? "/calendrier"}
                  className="flex gap-3 rounded-2xl px-1 py-1 transition-colors duration-hover hover:bg-white/55"
                >
                  <div className="w-14 shrink-0 pt-0.5 text-right">
                    <p className="text-meta font-medium tabular-nums text-foreground">{timeLabel}</p>
                  </div>
                  <div className="relative min-w-0 flex-1 border-l border-border/80 pl-3">
                    <span
                      className={cn(
                        "absolute top-1.5 -left-[4px] size-2 rounded-full",
                        kindDot(item.kind),
                      )}
                      aria-hidden="true"
                    />
                    <p className="truncate text-body font-medium text-foreground">{item.title}</p>
                    <p className="mt-0.5 truncate text-meta text-muted">
                      {item.company?.name ?? "Sans entreprise"}
                    </p>
                    <p className="mt-1 inline-flex items-center gap-1 text-meta text-faint">
                      {item.kind === "event" ? (
                        <Video className="size-3" aria-hidden="true" />
                      ) : item.kind === "follow_up" ? (
                        <Phone className="size-3" aria-hidden="true" />
                      ) : (
                        <MapPin className="size-3" aria-hidden="true" />
                      )}
                      {kindMeta(item)}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
