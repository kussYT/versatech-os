export function toDateKey(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayKey() {
  return toDateKey(new Date());
}

export function parseYearMonth(value: string | undefined) {
  const now = new Date();
  if (!value) {
    return { year: now.getFullYear(), month: now.getMonth() };
  }

  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) {
    return { year: now.getFullYear(), month: now.getMonth() };
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  if (!Number.isInteger(year) || month < 0 || month > 11) {
    return { year: now.getFullYear(), month: now.getMonth() };
  }

  return { year, month };
}

export function toYearMonthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export function addMonths(year: number, month: number, delta: number) {
  const date = new Date(year, month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

export function startOfLocalDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function endOfLocalDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function isLocalMidnight(date: Date) {
  return date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0;
}

export function getMonthGridDays(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - startOffset);
  const last = new Date(year, month + 1, 0);
  const cells = startOffset + last.getDate() <= 35 ? 35 : 42;

  return Array.from({ length: cells }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export function getMonthGridRange(year: number, month: number) {
  const days = getMonthGridDays(year, month);
  const first = days[0];
  const last = days[days.length - 1];
  if (!first || !last) {
    const fallback = new Date(year, month, 1);
    return { start: startOfLocalDay(fallback), end: endOfLocalDay(fallback) };
  }

  return {
    start: startOfLocalDay(first),
    end: endOfLocalDay(last),
  };
}

export function eachDateKey(startIso: string, endIso: string) {
  const start = startOfLocalDay(new Date(startIso));
  const end = startOfLocalDay(new Date(endIso));
  const keys: string[] = [];
  const cursor = new Date(start);

  while (cursor.getTime() <= end.getTime()) {
    keys.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return keys.length > 0 ? keys : [toDateKey(start)];
}

export function formatMonthTitle(year: number, month: number) {
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month, 1));
}

export function formatDayTitle(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(year, month - 1, day));
}

export function formatTime(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function atHour(dateKey: string, hours: number, minutes = 0) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

export function defaultSelectedDay(year: number, month: number) {
  const today = new Date();
  if (today.getFullYear() === year && today.getMonth() === month) {
    return toDateKey(today);
  }

  return toDateKey(new Date(year, month, 1));
}
