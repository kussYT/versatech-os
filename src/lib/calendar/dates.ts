import {
  addCivilDays,
  civilKey,
  endOfParisDay,
  formatTime as formatParisTime,
  fromParisDateTime,
  parisDateKey,
  parisParts,
  parisYearMonth,
  startOfParisDay,
  weekdayMondayIndex,
  type CivilDate,
} from "@/lib/dates";

export type MonthGridDay = {
  key: string;
  year: number;
  month: number;
  day: number;
};

export function toDateKey(date: Date) {
  return parisDateKey(date);
}

export function todayKey(now = new Date()) {
  return parisDateKey(now);
}

export function parseYearMonth(value: string | undefined, now = new Date()) {
  const current = parisYearMonth(now);
  if (!value) {
    return current;
  }

  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) {
    return current;
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  if (!Number.isInteger(year) || month < 0 || month > 11) {
    return current;
  }

  return { year, month };
}

export function toYearMonthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export function addMonths(year: number, month: number, delta: number) {
  const date = new Date(Date.UTC(year, month + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
}

export function startOfLocalDay(date: Date) {
  return startOfParisDay(date);
}

export function endOfLocalDay(date: Date) {
  return endOfParisDay(date);
}

export function isLocalMidnight(date: Date) {
  const parts = parisParts(date);
  return parts.hour === 0 && parts.minute === 0 && parts.second === 0;
}

export function getMonthGridDays(year: number, month: number): MonthGridDay[] {
  const monthNumber = month + 1;
  const startOffset = weekdayMondayIndex(year, monthNumber, 1);
  const lastDay = addCivilDays(year, monthNumber + 1, 1, -1).day;
  const cells = startOffset + lastDay <= 35 ? 35 : 42;

  return Array.from({ length: cells }, (_, index) => {
    const civil = addCivilDays(year, monthNumber, 1, index - startOffset);
    return {
      key: civilKey(civil),
      year: civil.year,
      month: civil.month - 1,
      day: civil.day,
    };
  });
}

export function getMonthGridRange(year: number, month: number) {
  const days = getMonthGridDays(year, month);
  const first = days[0];
  const last = days[days.length - 1];
  if (!first || !last) {
    const fallback = fromParisDateTime(year, month + 1, 1);
    return { start: startOfParisDay(fallback), end: endOfParisDay(fallback) };
  }

  return {
    start: fromParisDateTime(first.year, first.month + 1, first.day, 0, 0, 0, 0),
    end: fromParisDateTime(last.year, last.month + 1, last.day, 23, 59, 59, 999),
  };
}

function compareCivil(left: CivilDate, right: CivilDate) {
  return left.year - right.year || left.month - right.month || left.day - right.day;
}

export function eachDateKey(startIso: string, endIso: string) {
  const start = parisParts(new Date(startIso));
  const end = parisParts(new Date(endIso));
  const keys: string[] = [];
  let cursor: CivilDate = { year: start.year, month: start.month, day: start.day };
  const last: CivilDate = { year: end.year, month: end.month, day: end.day };

  while (compareCivil(cursor, last) <= 0) {
    keys.push(civilKey(cursor));
    cursor = addCivilDays(cursor.year, cursor.month, cursor.day, 1);
    if (keys.length > 400) {
      break;
    }
  }

  return keys.length > 0 ? keys : [civilKey({ year: start.year, month: start.month, day: start.day })];
}

export function formatMonthTitle(year: number, month: number) {
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month, 1)));
}

export function formatDayTitle(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatTime(value: Date | string) {
  return formatParisTime(value);
}

export function atHour(dateKey: string, hours: number, minutes = 0) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return fromParisDateTime(year, month, day, hours, minutes, 0, 0);
}

export function defaultSelectedDay(year: number, month: number, today = todayKey()) {
  const [todayYear, todayMonth] = today.split("-").map(Number);
  if (todayYear === year && todayMonth - 1 === month) {
    return today;
  }

  return civilKey({ year, month: month + 1, day: 1 });
}
