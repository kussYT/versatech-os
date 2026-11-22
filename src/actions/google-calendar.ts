"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/crm/action-result";
import { requireActor } from "@/lib/crm/actor";
import { readString } from "@/lib/crm/form-data";
import {
  disconnectGoogleCalendar,
  getValidAccessToken,
  setGoogleCalendarId,
  setGooglePushEnabled,
} from "@/lib/integrations/google/connection";
import { listGoogleCalendars } from "@/lib/integrations/google/calendar-api";
import {
  syncGoogleCalendarPull,
  syncGoogleCalendarPushMeetings,
} from "@/lib/integrations/google/sync";

function revalidateSettings() {
  revalidatePath("/parametres");
  revalidatePath("/calendrier");
  revalidatePath("/");
}

export async function disconnectGoogleCalendarAction(): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }

  await disconnectGoogleCalendar(auth.actor.id);
  revalidateSettings();
  return { ok: true, message: "Compte Google déconnecté." };
}

export async function setGooglePushEnabledAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }

  const enabled = readString(formData, "pushEnabled") === "on";
  const result = await setGooglePushEnabled(auth.actor.id, enabled);
  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  revalidateSettings();
  return {
    ok: true,
    message: enabled
      ? "Synchronisation automatique des RDV vers Google activée."
      : "Synchronisation automatique des RDV vers Google désactivée.",
  };
}

export async function setGoogleCalendarIdAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }

  const calendarId = readString(formData, "calendarId");
  const calendarSummary = readString(formData, "calendarSummary") || null;
  if (!calendarId) {
    return { ok: false, message: "Calendrier invalide." };
  }

  const result = await setGoogleCalendarId(
    auth.actor.id,
    calendarId,
    calendarSummary,
  );
  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  revalidateSettings();
  return { ok: true, message: "Calendrier Google sélectionné." };
}

export async function syncGoogleCalendarPullAction(): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }

  const result = await syncGoogleCalendarPull(auth.actor.id);
  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  revalidateSettings();
  const { imported, updated, remoteDeleted } = result.summary;
  return {
    ok: true,
    message: `Sync terminée : ${imported} importé(s), ${updated} mis à jour, ${remoteDeleted} marqué(s) supprimé(s) côté Google.`,
  };
}

export async function syncGoogleCalendarPushAction(): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }

  const result = await syncGoogleCalendarPushMeetings(auth.actor.id);
  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  revalidateSettings();
  return {
    ok: true,
    message: `Rattrapage terminé : ${result.summary.pushed} créé(s), ${result.summary.updated} mis à jour.`,
  };
}

export type GoogleCalendarOption = {
  id: string;
  summary: string;
  primary: boolean;
};

export async function listSelectableGoogleCalendarsAction(): Promise<
  | { ok: true; calendars: GoogleCalendarOption[] }
  | { ok: false; message: string }
> {
  const auth = await requireActor();
  if (!auth.ok) {
    return { ok: false, message: auth.result.message ?? "Non authentifié." };
  }

  const token = await getValidAccessToken(auth.actor.id);
  if (!token.ok) {
    return { ok: false, message: token.message };
  }

  const calendars = await listGoogleCalendars(token.accessToken);
  if (!calendars.ok) {
    return { ok: false, message: calendars.error.message };
  }

  return {
    ok: true,
    calendars: calendars.data.map((c) => ({
      id: c.id,
      summary: c.summary,
      primary: c.primary,
    })),
  };
}
