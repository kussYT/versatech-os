import "server-only";

import { GOOGLE_CALENDAR_API } from "@/lib/integrations/google/config";
import { logServerError } from "@/lib/observability/log-error";

const REQUEST_TIMEOUT_MS = 12_000;

export type GoogleCalendarListEntry = {
  id: string;
  summary: string;
  primary: boolean;
  timeZone: string | null;
};

export type GoogleEventDate = {
  date?: string;
  dateTime?: string;
  timeZone?: string;
};

export type GoogleCalendarEvent = {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  start?: GoogleEventDate;
  end?: GoogleEventDate;
  updated?: string;
};

export type GoogleEventsPage = {
  items: GoogleCalendarEvent[];
  nextPageToken: string | null;
  nextSyncToken: string | null;
};

export type GoogleApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "gone"
  | "unavailable";

export type GoogleApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: GoogleApiErrorCode; message: string } };

export async function listGoogleCalendars(
  accessToken: string,
): Promise<GoogleApiResult<GoogleCalendarListEntry[]>> {
  const result = await googleGet<{
    items?: Array<{
      id?: string;
      summary?: string;
      primary?: boolean;
      timeZone?: string;
      accessRole?: string;
    }>;
  }>(accessToken, "/users/me/calendarList");

  if (!result.ok) {
    return result;
  }

  const items = (result.data.items ?? [])
    .filter((entry) => entry.id && entry.accessRole !== "freeBusyReader")
    .map((entry) => ({
      id: entry.id as string,
      summary: entry.summary?.trim() || (entry.id as string),
      primary: entry.primary === true,
      timeZone: entry.timeZone ?? null,
    }));

  return { ok: true, data: items };
}

export async function listGoogleEvents(
  accessToken: string,
  calendarId: string,
  options: {
    timeMin?: string;
    timeMax?: string;
    syncToken?: string | null;
    pageToken?: string | null;
  },
): Promise<GoogleApiResult<GoogleEventsPage>> {
  const params = new URLSearchParams({
    singleEvents: "true",
    showDeleted: "true",
    maxResults: "250",
  });

  if (options.syncToken) {
    params.set("syncToken", options.syncToken);
  } else {
    params.set("orderBy", "startTime");
    if (options.timeMin) {
      params.set("timeMin", options.timeMin);
    }
    if (options.timeMax) {
      params.set("timeMax", options.timeMax);
    }
  }

  if (options.pageToken) {
    params.set("pageToken", options.pageToken);
  }

  const path = `/calendars/${encodeURIComponent(calendarId)}/events?${params}`;
  const result = await googleGet<{
    items?: GoogleCalendarEvent[];
    nextPageToken?: string;
    nextSyncToken?: string;
  }>(accessToken, path);

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    data: {
      items: result.data.items ?? [],
      nextPageToken: result.data.nextPageToken ?? null,
      nextSyncToken: result.data.nextSyncToken ?? null,
    },
  };
}

export async function insertGoogleEvent(
  accessToken: string,
  calendarId: string,
  body: Record<string, unknown>,
): Promise<GoogleApiResult<GoogleCalendarEvent>> {
  // sendUpdates=none: never email invitees (we do not set attendees anyway).
  return googleWrite(
    accessToken,
    "POST",
    `/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=none`,
    body,
  );
}

export async function patchGoogleEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  body: Record<string, unknown>,
): Promise<GoogleApiResult<GoogleCalendarEvent>> {
  return googleWrite(
    accessToken,
    "PATCH",
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`,
    body,
  );
}

export async function deleteGoogleEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<GoogleApiResult<{ deleted: true }>> {
  const response = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    },
  );

  if (response.status === 204 || response.status === 410) {
    return { ok: true, data: { deleted: true } };
  }

  return mapError(response.status, "Google Calendar delete failed.");
}

async function googleGet<T>(
  accessToken: string,
  path: string,
): Promise<GoogleApiResult<T>> {
  try {
    const response = await fetch(`${GOOGLE_CALENDAR_API}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });

    if (!response.ok) {
      return mapError(response.status, "Google Calendar API request failed.");
    }

    return { ok: true, data: (await response.json()) as T };
  } catch (error) {
    logServerError("google.calendar.get", error);
    return {
      ok: false,
      error: { code: "unavailable", message: "Google Calendar indisponible." },
    };
  }
}

async function googleWrite(
  accessToken: string,
  method: "POST" | "PATCH",
  path: string,
  body: Record<string, unknown>,
): Promise<GoogleApiResult<GoogleCalendarEvent>> {
  try {
    const response = await fetch(`${GOOGLE_CALENDAR_API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });

    if (!response.ok) {
      return mapError(response.status, "Google Calendar write failed.");
    }

    return { ok: true, data: (await response.json()) as GoogleCalendarEvent };
  } catch (error) {
    logServerError("google.calendar.write", error);
    return {
      ok: false,
      error: { code: "unavailable", message: "Google Calendar indisponible." },
    };
  }
}

function mapError(
  status: number,
  fallback: string,
): { ok: false; error: { code: GoogleApiErrorCode; message: string } } {
  if (status === 401) {
    return { ok: false, error: { code: "unauthorized", message: "Session Google expirée." } };
  }
  if (status === 403) {
    return { ok: false, error: { code: "forbidden", message: "Accès Google refusé." } };
  }
  if (status === 404) {
    return { ok: false, error: { code: "not_found", message: "Ressource Google introuvable." } };
  }
  if (status === 410) {
    return {
      ok: false,
      error: { code: "gone", message: "Jeton de synchronisation Google expiré." },
    };
  }
  return { ok: false, error: { code: "unavailable", message: fallback } };
}
