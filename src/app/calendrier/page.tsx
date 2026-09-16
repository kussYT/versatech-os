import type { Metadata } from "next";
import { CalendarView } from "@/components/calendar/calendar-view";
import { getMonthGridRange, parseYearMonth, toDateKey } from "@/lib/calendar/dates";
import { endOfToday, startOfToday } from "@/lib/crm/form-data";
import {
  listCalendarItems,
  listCalendarLinkTargets,
  mergeCalendarItems,
} from "@/lib/queries/calendar";
import type { CalendarItem } from "@/lib/calendar/types";

export const metadata: Metadata = {
  title: "Calendrier",
};

export const dynamic = "force-dynamic";

function firstString(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

export default async function CalendrierPage({
  searchParams,
}: PageProps<"/calendrier">) {
  const params = await searchParams;
  const { year, month } = parseYearMonth(firstString(params.month));
  const grid = getMonthGridRange(year, month);
  const todayStart = startOfToday();
  const todayEnd = endOfToday();
  const today = toDateKey(todayStart);
  const todayInGrid = todayStart >= grid.start && todayEnd <= grid.end;

  const [monthItems, todayItems, links] = await Promise.all([
    listCalendarItems(grid.start, grid.end),
    todayInGrid
      ? Promise.resolve([] as CalendarItem[])
      : listCalendarItems(todayStart, todayEnd),
    listCalendarLinkTargets(),
  ]);

  return (
    <CalendarView
      key={`${year}-${month}`}
      year={year}
      month={month}
      today={today}
      items={mergeCalendarItems([monthItems, todayItems])}
      companies={links.companies}
      projects={links.projects}
    />
  );
}
