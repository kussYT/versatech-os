/**
 * Fuseau métier unique : Europe/Paris.
 * PostgreSQL stocke des instants UTC ; le jour civil, les bornes « aujourd'hui »,
 * le formatage et les champs datetime-local se lisent/écrivent en Paris.
 */
export const BUSINESS_TIME_ZONE = "Europe/Paris";
export const BUSINESS_LOCALE = "fr-FR";

export type CivilDate = {
  year: number;
  month: number;
  day: number;
};

export type ParisParts = CivilDate & {
  hour: number;
  minute: number;
  second: number;
};

export type DueBucket = "overdue" | "today" | "upcoming";

const parisPartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME_LOCAL =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/;

function pad(value: number, size = 2) {
  return String(value).padStart(size, "0");
}

function toDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function readParts(date: Date) {
  const values = Object.fromEntries(
    parisPartsFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  let hour = Number(values.hour);
  if (hour === 24) {
    hour = 0;
  }

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour,
    minute: Number(values.minute),
    second: Number(values.second),
  } satisfies ParisParts;
}

export function parisParts(value: Date | string): ParisParts {
  return readParts(toDate(value));
}

export function civilKey(date: CivilDate) {
  return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
}

export function parisDateKey(value: Date | string) {
  const parts = parisParts(value);
  return civilKey(parts);
}

export function parisYearMonth(now = new Date()) {
  const parts = parisParts(now);
  return { year: parts.year, month: parts.month - 1 };
}

export function addCivilDays(year: number, month: number, day: number, delta: number): CivilDate {
  const utc = new Date(Date.UTC(year, month - 1, day + delta));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

export function isValidCivilDate(year: number, month: number, day: number) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }

  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day
  );
}

function offsetMs(date: Date) {
  const parts = readParts(date);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    date.getUTCMilliseconds(),
  );
  return asUtc - date.getTime();
}

export function fromParisDateTime(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0,
) {
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const first = new Date(wallAsUtc - offsetMs(new Date(wallAsUtc)));
  return new Date(wallAsUtc - offsetMs(first));
}

export function startOfParisDay(value: Date | string) {
  const parts = parisParts(value);
  return fromParisDateTime(parts.year, parts.month, parts.day, 0, 0, 0, 0);
}

export function endOfParisDay(value: Date | string) {
  const parts = parisParts(value);
  return fromParisDateTime(parts.year, parts.month, parts.day, 23, 59, 59, 999);
}

export function startOfToday(now = new Date()) {
  return startOfParisDay(now);
}

export function endOfToday(now = new Date()) {
  return endOfParisDay(now);
}

export function dueBucket(dueAt: Date, now = new Date()): DueBucket {
  if (dueAt.getTime() < startOfToday(now).getTime()) {
    return "overdue";
  }

  if (dueAt.getTime() <= endOfToday(now).getTime()) {
    return "today";
  }

  return "upcoming";
}

export function defaultFollowUpDueAt(now = new Date()) {
  const parts = parisParts(now);
  const next = addCivilDays(parts.year, parts.month, parts.day, 1);
  return fromParisDateTime(next.year, next.month, next.day, 9, 0, 0, 0);
}

export function parseDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const match = DATE_ONLY.exec(trimmed);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!isValidCivilDate(year, month, day)) {
    return null;
  }

  return fromParisDateTime(year, month, day, 0, 0, 0, 0);
}

export function parseDateTimeLocal(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const match = DATE_TIME_LOCAL.exec(trimmed);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = match[4] === undefined ? 0 : Number(match[4]);
  const minute = match[5] === undefined ? 0 : Number(match[5]);
  const second = match[6] === undefined ? 0 : Number(match[6]);
  const millisecond = match[7] === undefined ? 0 : Number(match[7].padEnd(3, "0"));

  if (!isValidCivilDate(year, month, day)) {
    return null;
  }

  if (hour > 23 || minute > 59 || second > 59) {
    return null;
  }

  return fromParisDateTime(year, month, day, hour, minute, second, millisecond);
}

export function toDateInputValue(value: Date | string) {
  return parisDateKey(value);
}

export function toDateTimeLocalValue(value: Date | string) {
  const parts = parisParts(value);
  return `${civilKey(parts)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function formatDateTime(value: Date | string) {
  return new Intl.DateTimeFormat(BUSINESS_LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: BUSINESS_TIME_ZONE,
  }).format(toDate(value));
}

export function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat(BUSINESS_LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: BUSINESS_TIME_ZONE,
  }).format(toDate(value));
}

export function formatLongDate(value: Date | string = new Date()) {
  return new Intl.DateTimeFormat(BUSINESS_LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: BUSINESS_TIME_ZONE,
  }).format(toDate(value));
}

export function formatTime(value: Date | string) {
  return new Intl.DateTimeFormat(BUSINESS_LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: BUSINESS_TIME_ZONE,
  }).format(toDate(value));
}

export function weekdayMondayIndex(year: number, month: number, day: number) {
  const noon = fromParisDateTime(year, month, day, 12, 0, 0, 0);
  return (noon.getUTCDay() + 6) % 7;
}

export const ANALYTICS_PERIODS = ["30d", "90d", "year", "all"] as const;
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

export type InstantRange = {
  start: Date | null;
  end: Date | null;
};

export const ANALYTICS_PERIOD_LABELS: Record<AnalyticsPeriod, string> = {
  "30d": "30 jours",
  "90d": "90 jours",
  year: "Année",
  all: "Global",
};

export function isAnalyticsPeriod(value: string): value is AnalyticsPeriod {
  return (ANALYTICS_PERIODS as readonly string[]).includes(value);
}

export function parseAnalyticsPeriod(value: string | undefined): AnalyticsPeriod {
  if (value && isAnalyticsPeriod(value)) {
    return value;
  }

  return "30d";
}

/**
 * Bornes inclusives en Europe/Paris.
 * 30/90 jours = N jours civils se terminant aujourd'hui (aujourd'hui inclus).
 * Année = 1er janvier Paris → fin d'aujourd'hui.
 * Global = pas de borne.
 */
export function analyticsPeriodRange(period: AnalyticsPeriod, now = new Date()): InstantRange {
  if (period === "all") {
    return { start: null, end: null };
  }

  const end = endOfToday(now);
  const parts = parisParts(now);

  if (period === "year") {
    return {
      start: fromParisDateTime(parts.year, 1, 1, 0, 0, 0, 0),
      end,
    };
  }

  const daysBack = period === "30d" ? 29 : 89;
  const startCivil = addCivilDays(parts.year, parts.month, parts.day, -daysBack);

  return {
    start: fromParisDateTime(startCivil.year, startCivil.month, startCivil.day, 0, 0, 0, 0),
    end,
  };
}

export function isInstantInRange(instant: Date, range: InstantRange) {
  if (range.start && instant.getTime() < range.start.getTime()) {
    return false;
  }

  if (range.end && instant.getTime() > range.end.getTime()) {
    return false;
  }

  return true;
}
