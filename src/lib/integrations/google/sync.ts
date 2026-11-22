import "server-only";

import { prisma } from "@/lib/db/prisma";
import {
  listGoogleEvents,
  insertGoogleEvent,
  patchGoogleEvent,
  type GoogleCalendarEvent,
} from "@/lib/integrations/google/calendar-api";
import { GOOGLE_PROVIDER } from "@/lib/integrations/google/config";
import { getValidAccessToken } from "@/lib/integrations/google/connection";
import {
  mapGoogleEventToLocal,
  mapLocalMeetingToGoogleBody,
} from "@/lib/integrations/google/map-event";
import { evaluateGooglePushEligibility } from "@/lib/integrations/google/push-eligibility";
import { fromParisDateTime, parisParts, startOfParisDay } from "@/lib/dates";
import { logServerError } from "@/lib/observability/log-error";
import { revalidateCalendar } from "@/lib/crm/revalidate";

function shiftParisMonths(now: Date, deltaMonths: number) {
  const parts = parisParts(now);
  return fromParisDateTime(parts.year, parts.month + deltaMonths, 1, 0, 0, 0, 0);
}

export type GoogleSyncSummary = {
  imported: number;
  updated: number;
  remoteDeleted: number;
  pushed: number;
  skipped: number;
};

/**
 * Pull Google → VersaTech (idempotent). Never writes to Google.
 * Window: −1 month … +6 months Paris when no syncToken.
 */
export async function syncGoogleCalendarPull(
  userId: string,
): Promise<{ ok: true; summary: GoogleSyncSummary } | { ok: false; message: string }> {
  const token = await getValidAccessToken(userId);
  if (!token.ok) {
    return token;
  }

  const connection = await prisma.googleCalendarConnection.findUnique({
    where: { userId },
    select: { syncToken: true, calendarId: true },
  });
  if (!connection) {
    return { ok: false, message: "Compte Google non connecté." };
  }

  const summary: GoogleSyncSummary = {
    imported: 0,
    updated: 0,
    remoteDeleted: 0,
    pushed: 0,
    skipped: 0,
  };

  try {
    let pageToken: string | null = null;
    let nextSyncToken: string | null = null;
    let syncToken = connection.syncToken;
    let usedFullSync = !syncToken;

    const now = new Date();
    const timeMin = startOfParisDay(shiftParisMonths(now, -1)).toISOString();
    const timeMax = startOfParisDay(shiftParisMonths(now, 6)).toISOString();

    for (;;) {
      let page = await listGoogleEvents(token.accessToken, connection.calendarId, {
        syncToken,
        pageToken,
        timeMin: usedFullSync ? timeMin : undefined,
        timeMax: usedFullSync ? timeMax : undefined,
      });

      if (!page.ok && page.error.code === "gone") {
        // syncToken expired → full resync
        syncToken = null;
        usedFullSync = true;
        pageToken = null;
        await prisma.googleCalendarConnection.update({
          where: { userId },
          data: { syncToken: null },
        });
        page = await listGoogleEvents(token.accessToken, connection.calendarId, {
          timeMin,
          timeMax,
        });
      }

      if (!page.ok) {
        return { ok: false, message: page.error.message };
      }

      for (const event of page.data.items) {
        const result = await upsertImportedGoogleEvent(event);
        summary[result] += 1;
      }

      if (page.data.nextSyncToken) {
        nextSyncToken = page.data.nextSyncToken;
      }

      pageToken = page.data.nextPageToken;
      if (!pageToken) {
        break;
      }
    }

    await prisma.googleCalendarConnection.update({
      where: { userId },
      data: {
        lastSyncedAt: new Date(),
        ...(nextSyncToken ? { syncToken: nextSyncToken } : {}),
      },
    });

    await prisma.activityLog.create({
      data: {
        actorId: userId,
        entityType: "GoogleCalendarConnection",
        entityId: userId,
        action: "google_calendar.synced",
        metadata: { ...summary, provider: GOOGLE_PROVIDER },
      },
    });

    revalidateCalendar();
    return { ok: true, summary };
  } catch (error) {
    logServerError("google.calendar.sync", error);
    return { ok: false, message: "Échec de la synchronisation Google." };
  }
}

export type PushCalendarEventResult =
  | { ok: true; action: "created" | "updated" | "skipped"; reason?: string }
  | { ok: false; message: string };

/**
 * Targeted CRM RDV → Google create/update. Idempotent via externalId.
 * Never deletes on Google. Never writes when pushEnabled is off.
 */
export async function pushCalendarEventToGoogle(
  userId: string,
  eventId: string,
  options: { requirePushEnabled?: boolean } = {},
): Promise<PushCalendarEventResult> {
  const requirePushEnabled = options.requirePushEnabled !== false;

  const event = await prisma.calendarEvent.findUnique({
    where: { id: eventId },
  });
  if (!event) {
    return { ok: false, message: "Événement introuvable." };
  }

  const eligibility = evaluateGooglePushEligibility(event);
  if (!eligibility.eligible) {
    return { ok: true, action: "skipped", reason: eligibility.reason };
  }

  const connection = await prisma.googleCalendarConnection.findUnique({
    where: { userId },
    select: { id: true, pushEnabled: true },
  });
  if (!connection) {
    return { ok: true, action: "skipped", reason: "not_connected" };
  }
  if (requirePushEnabled && !connection.pushEnabled) {
    return { ok: true, action: "skipped", reason: "push_disabled" };
  }

  const token = await getValidAccessToken(userId);
  if (!token.ok) {
    // Connected but token refresh failed — mark for manual retry.
    await markPushError(event.id, "unauthorized");
    return { ok: false, message: token.message };
  }

  await prisma.calendarEvent.update({
    where: { id: event.id },
    data: { syncStatus: "pending" },
  });

  const body = mapLocalMeetingToGoogleBody({
    title: event.title,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    allDay: event.allDay,
    description: event.description,
    location: event.location,
    timeZone: event.timeZone,
  });

  try {
    if (eligibility.mode === "update" && event.externalId) {
      const patched = await patchGoogleEvent(
        token.accessToken,
        token.calendarId,
        event.externalId,
        body,
      );
      if (!patched.ok) {
        await markPushError(event.id, patched.error.code);
        return { ok: false, message: patched.error.message };
      }
      await prisma.calendarEvent.update({
        where: { id: event.id },
        data: {
          syncStatus: "pushed",
          lastSyncedAt: new Date(),
          htmlLink: patched.data.htmlLink ?? event.htmlLink,
        },
      });
      return { ok: true, action: "updated" };
    }

    const created = await insertGoogleEvent(
      token.accessToken,
      token.calendarId,
      body,
    );
    if (!created.ok || !created.data.id) {
      await markPushError(
        event.id,
        created.ok ? "missing_id" : created.error.code,
      );
      return {
        ok: false,
        message: created.ok
          ? "Réponse Google sans identifiant d'événement."
          : created.error.message,
      };
    }

    await prisma.calendarEvent.update({
      where: { id: event.id },
      data: {
        externalProvider: GOOGLE_PROVIDER,
        externalId: created.data.id,
        syncStatus: "pushed",
        lastSyncedAt: new Date(),
        htmlLink: created.data.htmlLink ?? null,
      },
    });
    return { ok: true, action: "created" };
  } catch (error) {
    logServerError("google.calendar.push_one", error);
    await markPushError(event.id, "unavailable");
    return { ok: false, message: "Échec de la synchronisation Google." };
  }
}

/**
 * Best-effort auto-push after CRM save. Never throws; never blocks CRM truth.
 */
export async function maybeAutoPushCalendarEvent(
  userId: string,
  eventId: string,
): Promise<void> {
  try {
    const result = await pushCalendarEventToGoogle(userId, eventId, {
      requirePushEnabled: true,
    });
    if (!result.ok) {
      logServerError("google.calendar.auto_push", new Error(result.message));
    }
  } catch (error) {
    logServerError("google.calendar.auto_push", error);
  }
}

/**
 * Manual / catch-up push for pending CRM RDVs (and error retries).
 * Never deletes on Google. Never modifies unrelated Google events.
 */
export async function syncGoogleCalendarPushMeetings(
  userId: string,
): Promise<{ ok: true; summary: GoogleSyncSummary } | { ok: false; message: string }> {
  const token = await getValidAccessToken(userId);
  if (!token.ok) {
    return token;
  }
  if (!token.pushEnabled) {
    return {
      ok: false,
      message:
        "La synchronisation automatique vers Google est désactivée. Activez-la dans les paramètres.",
    };
  }

  const summary: GoogleSyncSummary = {
    imported: 0,
    updated: 0,
    remoteDeleted: 0,
    pushed: 0,
    skipped: 0,
  };

  const meetings = await prisma.calendarEvent.findMany({
    where: {
      type: "MEETING",
      NOT: {
        OR: [
          { syncStatus: "imported" },
          { syncStatus: "remote_deleted" },
        ],
      },
      OR: [
        { externalId: null },
        {
          AND: [
            { externalProvider: GOOGLE_PROVIDER },
            {
              OR: [
                { syncStatus: "pushed" },
                { syncStatus: "pending" },
                { syncStatus: { startsWith: "error:" } },
              ],
            },
          ],
        },
      ],
    },
    orderBy: { startsAt: "asc" },
    take: 100,
    select: { id: true },
  });

  for (const meeting of meetings) {
    const result = await pushCalendarEventToGoogle(userId, meeting.id, {
      requirePushEnabled: true,
    });
    if (!result.ok) {
      summary.skipped += 1;
      continue;
    }
    if (result.action === "created") {
      summary.pushed += 1;
    } else if (result.action === "updated") {
      summary.updated += 1;
    } else {
      summary.skipped += 1;
    }
  }

  revalidateCalendar();
  return { ok: true, summary };
}

async function markPushError(eventId: string, code: string) {
  try {
    await prisma.calendarEvent.update({
      where: { id: eventId },
      data: { syncStatus: `error:${code}` },
    });
  } catch (error) {
    logServerError("google.calendar.mark_error", error);
  }
}

async function upsertImportedGoogleEvent(
  event: GoogleCalendarEvent,
): Promise<keyof GoogleSyncSummary> {
  const mapped = mapGoogleEventToLocal(event);
  if (!mapped) {
    return "skipped";
  }

  const existing = await prisma.calendarEvent.findUnique({
    where: {
      externalProvider_externalId: {
        externalProvider: mapped.externalProvider,
        externalId: mapped.externalId,
      },
    },
    select: { id: true, syncStatus: true },
  });

  if (mapped.cancelled) {
    if (!existing) {
      return "skipped";
    }
    // Do not hard-delete: mark remote_deleted for explicit local cleanup later.
    if (existing.syncStatus !== "remote_deleted") {
      await prisma.calendarEvent.update({
        where: { id: existing.id },
        data: { syncStatus: "remote_deleted", lastSyncedAt: new Date() },
      });
      return "remoteDeleted";
    }
    return "skipped";
  }

  // Never overwrite a CRM-pushed meeting's CRM-owned fields blindly on title conflicts:
  // imported events are Google SoT; pushed events stay CRM-piloted (skip import overwrite).
  if (existing?.syncStatus === "pushed") {
    return "skipped";
  }

  if (existing) {
    await prisma.calendarEvent.update({
      where: { id: existing.id },
      data: {
        title: mapped.title,
        startsAt: mapped.startsAt,
        endsAt: mapped.endsAt,
        allDay: mapped.allDay,
        description: mapped.description,
        location: mapped.location,
        timeZone: mapped.timeZone,
        htmlLink: mapped.htmlLink,
        type: "MEETING",
        syncStatus: "imported",
        lastSyncedAt: new Date(),
      },
    });
    return "updated";
  }

  await prisma.calendarEvent.create({
    data: {
      title: mapped.title,
      type: "MEETING",
      startsAt: mapped.startsAt,
      endsAt: mapped.endsAt,
      allDay: mapped.allDay,
      description: mapped.description,
      location: mapped.location,
      timeZone: mapped.timeZone,
      htmlLink: mapped.htmlLink,
      externalProvider: mapped.externalProvider,
      externalId: mapped.externalId,
      syncStatus: "imported",
      lastSyncedAt: new Date(),
    },
  });
  return "imported";
}
