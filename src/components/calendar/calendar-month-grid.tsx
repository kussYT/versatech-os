import { calendarChipClass } from "@/components/calendar/calendar-kind-badge";
import { eachDateKey, formatDayTitle, formatTime, getMonthGridDays } from "@/lib/calendar/dates";
import { calendarItemLabel } from "@/lib/calendar/labels";
import type { CalendarItem } from "@/lib/calendar/types";
import { cn } from "@/lib/cn";

const WEEKDAYS = [
  { short: "L", label: "Lundi" },
  { short: "M", label: "Mardi" },
  { short: "M", label: "Mercredi" },
  { short: "J", label: "Jeudi" },
  { short: "V", label: "Vendredi" },
  { short: "S", label: "Samedi" },
  { short: "D", label: "Dimanche" },
] as const;

type CalendarMonthGridProps = {
  year: number;
  month: number;
  items: CalendarItem[];
  selectedDay: string;
  today: string;
  onSelectDay: (dateKey: string) => void;
};

function itemsByDay(items: CalendarItem[]) {
  const map = new Map<string, CalendarItem[]>();
  for (const entry of items) {
    for (const key of eachDateKey(entry.startsAt, entry.endsAt)) {
      const list = map.get(key) ?? [];
      list.push(entry);
      map.set(key, list);
    }
  }
  return map;
}

export function CalendarMonthGrid({
  year,
  month,
  items,
  selectedDay,
  today,
  onSelectDay,
}: CalendarMonthGridProps) {
  const days = getMonthGridDays(year, month);
  const grouped = itemsByDay(items);

  return (
    <div role="grid" aria-label="Vue mensuelle" className="min-w-0">
      <div role="row" className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((weekday, index) => (
          <div
            key={`${weekday.label}-${index}`}
            role="columnheader"
            className="px-1 py-2 text-center text-badge tracking-wide text-muted uppercase"
          >
            <span aria-hidden="true">{weekday.short}</span>
            <span className="sr-only">{weekday.label}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((date) => {
          const key = date.key;
          const inMonth = date.month === month;
          const isToday = key === today;
          const isSelected = key === selectedDay;
          const dayItems = grouped.get(key) ?? [];
          const extra = Math.max(0, dayItems.length - 3);
          const preview = dayItems.slice(0, 3);

          return (
            <div key={key} role="gridcell" className="min-w-0">
              <button
                type="button"
                onClick={() => onSelectDay(key)}
                aria-pressed={isSelected}
                aria-current={isToday ? "date" : undefined}
                aria-label={`${formatDayTitle(key)}${dayItems.length > 0 ? ` · ${dayItems.length} élément${dayItems.length > 1 ? "s" : ""}` : ""}`}
                className={cn(
                  "flex min-h-16 w-full flex-col gap-1 rounded-lg border border-transparent bg-background/40 p-1.5 text-left sm:min-h-24",
                  "motion-safe:transition-[border-color,background-color] motion-safe:duration-hover",
                  "hover:border-primary/35 hover:bg-surface-high/80",
                  !inMonth && "opacity-45",
                  isToday && "border-cyan/40",
                  isSelected && "border-primary/60 bg-primary/10",
                )}
              >
                <span
                  className={cn(
                    "text-meta tabular-nums",
                    isToday ? "font-semibold text-cyan" : "text-muted",
                    isSelected && "text-foreground",
                  )}
                >
                  {date.day}
                </span>
                <span className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                  {preview.map((entry) => (
                    <span
                      key={entry.id}
                      className={cn(
                        "truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight",
                        calendarChipClass(entry),
                      )}
                    >
                      {entry.allDay ? entry.title : `${formatTime(entry.startsAt)} ${entry.title}`}
                    </span>
                  ))}
                  {extra > 0 ? (
                    <span className="px-1 text-[10px] text-faint">+{extra}</span>
                  ) : null}
                </span>
                <span className="flex flex-wrap gap-0.5 sm:hidden">
                  {preview.map((entry) => (
                    <span
                      key={entry.id}
                      className={cn("size-1.5 rounded-full bg-current", calendarChipClass(entry), "border-0 px-0")}
                      title={`${calendarItemLabel(entry)} · ${entry.title}`}
                    />
                  ))}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
