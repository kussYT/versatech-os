"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { CalendarDayPanel } from "@/components/calendar/calendar-day-panel";
import { CalendarEventDialog } from "@/components/calendar/calendar-event-dialog";
import { CalendarMonthGrid } from "@/components/calendar/calendar-month-grid";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  addMonths,
  defaultSelectedDay,
  eachDateKey,
  formatDayTitle,
  formatMonthTitle,
  todayKey,
  toYearMonthKey,
} from "@/lib/calendar/dates";
import type {
  CalendarCompanyOption,
  CalendarItem,
  CalendarProjectOption,
} from "@/lib/calendar/types";
import { cn } from "@/lib/cn";

type CalendarViewProps = {
  year: number;
  month: number;
  items: CalendarItem[];
  companies: CalendarCompanyOption[];
  projects: CalendarProjectOption[];
};

function itemsOnDay(items: CalendarItem[], dateKey: string) {
  return items.filter((entry) => eachDateKey(entry.startsAt, entry.endsAt).includes(dateKey));
}

export function CalendarView({ year, month, items, companies, projects }: CalendarViewProps) {
  const today = todayKey();
  const [selectedDay, setSelectedDay] = useState(() => defaultSelectedDay(year, month));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CalendarItem | null>(null);

  const selectedItems = useMemo(
    () => itemsOnDay(items, selectedDay),
    [items, selectedDay],
  );
  const todayItems = useMemo(() => itemsOnDay(items, today), [items, today]);

  const previous = addMonths(year, month, -1);
  const next = addMonths(year, month, 1);
  const currentMonthKey = toYearMonthKey(new Date().getFullYear(), new Date().getMonth());
  const viewingCurrentMonth = toYearMonthKey(year, month) === currentMonthKey;

  function openCreate() {
    setEditingItem(null);
    setDialogOpen(true);
  }

  function openEdit(item: CalendarItem) {
    setEditingItem(item);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        meta="Planning interne"
        title="Calendrier"
        description="Vue mensuelle des événements manuels, relances, tâches, deadlines et jalons — sans duplication."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" aria-hidden="true" />
            Nouvel événement
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-h2 capitalize text-foreground">{formatMonthTitle(year, month)}</h2>
        <div className="flex items-center gap-2">
          <Link
            href={`/calendrier?month=${toYearMonthKey(previous.year, previous.month)}`}
            className={buttonVariants({ variant: "secondary", size: "icon" })}
            aria-label="Mois précédent"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Link>
          {viewingCurrentMonth ? (
            <Button variant="secondary" size="sm" onClick={() => setSelectedDay(today)}>
              Aujourd&apos;hui
            </Button>
          ) : (
            <Link
              href="/calendrier"
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              Aujourd&apos;hui
            </Link>
          )}
          <Link
            href={`/calendrier?month=${toYearMonthKey(next.year, next.month)}`}
            className={buttonVariants({ variant: "secondary", size: "icon" })}
            aria-label="Mois suivant"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(19rem,1fr)]">
        <Card className="card-aurora p-3 sm:p-4">
          <CalendarMonthGrid
            year={year}
            month={month}
            items={items}
            selectedDay={selectedDay}
            today={today}
            onSelectDay={(dateKey) => {
              setSelectedDay(dateKey);
              setSelectedId(null);
            }}
          />
        </Card>

        <div className="space-y-4">
          <Card className="p-4 sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-section capitalize text-foreground">{formatDayTitle(selectedDay)}</h3>
                <p className="mt-1 text-meta text-muted">
                  {selectedItems.length === 0
                    ? "Aucun élément"
                    : `${selectedItems.length} élément${selectedItems.length > 1 ? "s" : ""}`}
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={openCreate}>
                Ajouter
              </Button>
            </div>
            <CalendarDayPanel
              dateKey={selectedDay}
              items={selectedItems}
              selectedId={selectedId}
              onSelect={(entry) => setSelectedId(entry.id)}
              onEdit={openEdit}
              emptyTitle="Rien de prévu"
              emptyDescription="Créez un événement manuel, ou consultez les relances et projets liés."
            />
          </Card>

          <Card className={cn("card-aurora p-4 sm:p-5")}>
            <div className="mb-4 flex items-center gap-2">
              <CalendarDays className="size-4 text-cyan" aria-hidden="true" />
              <h3 className="text-section text-foreground">Aujourd&apos;hui</h3>
            </div>
            <CalendarDayPanel
              dateKey={today}
              items={todayItems}
              selectedId={selectedId}
              onSelect={(entry) => {
                setSelectedDay(today);
                setSelectedId(entry.id);
              }}
              onEdit={openEdit}
              emptyTitle="Aucun événement aujourd'hui"
              emptyDescription="Les échéances du jour apparaissent ici."
            />
          </Card>
        </div>
      </div>

      <CalendarEventDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditingItem(null);
        }}
        selectedDay={selectedDay}
        item={editingItem}
        companies={companies}
        projects={projects}
      />
    </div>
  );
}
