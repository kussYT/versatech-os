import type { GoogleCalendarEvent } from "@/lib/integrations/google/calendar-api";
import { GOOGLE_PROVIDER } from "@/lib/integrations/google/config";
import { endOfParisDay, startOfParisDay } from "@/lib/dates";

export type MappedGoogleEvent = {
  externalProvider: typeof GOOGLE_PROVIDER;
  externalId: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  description: string | null;
  location: string | null;
  timeZone: string | null;
  htmlLink: string | null;
  cancelled: boolean;
};

/**
 * Map a Google Calendar event to CRM fields.
 * All-day dates are civil days → Europe/Paris day bounds.
 * Timed events keep the absolute instant from Google (dateTime is offset/Z).
 */
export function mapGoogleEventToLocal(
  event: GoogleCalendarEvent,
  fallbackTimeZone = "Europe/Paris",
): MappedGoogleEvent | null {
  if (!event.id) {
    return null;
  }

  const cancelled = event.status === "cancelled";
  const start = event.start;
  const end = event.end;

  if (!start || (!cancelled && !end)) {
    return null;
  }

  const allDay = Boolean(start.date) || Boolean(end?.date);
  let startsAt: Date;
  let endsAt: Date;
  let timeZone: string | null = start.timeZone ?? end?.timeZone ?? null;

  if (allDay) {
    const startCivil = start.date ?? end?.date;
    const endCivil = end?.date ?? start.date;
    if (!startCivil || !endCivil) {
      return null;
    }
    // Google all-day end is exclusive; convert to inclusive civil end.
    const endExclusive = parseCivilDate(endCivil);
    const endInclusive = new Date(endExclusive.getTime() - 24 * 60 * 60 * 1000);
    startsAt = startOfParisDay(parseCivilDate(startCivil));
    endsAt = endOfParisDay(endInclusive);
    timeZone = timeZone ?? fallbackTimeZone;
  } else {
    if (!start.dateTime) {
      return null;
    }
    startsAt = new Date(start.dateTime);
    endsAt = end?.dateTime ? new Date(end.dateTime) : new Date(startsAt.getTime() + 60 * 60 * 1000);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      return null;
    }
    timeZone = timeZone ?? fallbackTimeZone;
  }

  return {
    externalProvider: GOOGLE_PROVIDER,
    externalId: event.id,
    title: event.summary?.trim() || "(Sans titre)",
    startsAt,
    endsAt,
    allDay,
    description: event.description?.trim() || null,
    location: event.location?.trim() || null,
    timeZone,
    htmlLink: event.htmlLink?.trim() || null,
    cancelled,
  };
}

export function mapLocalMeetingToGoogleBody(input: {
  title: string;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  description?: string | null;
  location?: string | null;
  timeZone?: string | null;
}) {
  const timeZone = input.timeZone?.trim() || "Europe/Paris";

  // reminders.useDefault: keep the Google Calendar / phone notification defaults.
  // No attendees → no client invitations.
  const reminders = { useDefault: true };

  if (input.allDay) {
    const start = toCivilDateParis(input.startsAt);
    // Google exclusive end = day after inclusive end.
    const endInclusive = toCivilDateParis(input.endsAt);
    const endExclusive = addCivilDays(endInclusive, 1);
    return {
      summary: input.title,
      description: input.description ?? undefined,
      location: input.location ?? undefined,
      start: { date: start },
      end: { date: endExclusive },
      reminders,
    };
  }

  return {
    summary: input.title,
    description: input.description ?? undefined,
    location: input.location ?? undefined,
    start: { dateTime: input.startsAt.toISOString(), timeZone },
    end: { dateTime: input.endsAt.toISOString(), timeZone },
    reminders,
  };
}

function parseCivilDate(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  // Noon UTC avoids DST edge when converting via Paris helpers.
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

function toCivilDateParis(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addCivilDays(civil: string, days: number) {
  const [y, m, d] = civil.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  return next.toISOString().slice(0, 10);
}
