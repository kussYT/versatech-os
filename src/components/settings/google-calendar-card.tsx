"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  disconnectGoogleCalendarAction,
  listSelectableGoogleCalendarsAction,
  setGoogleCalendarIdAction,
  setGooglePushEnabledAction,
  syncGoogleCalendarPullAction,
  syncGoogleCalendarPushAction,
  type GoogleCalendarOption,
} from "@/actions/google-calendar";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card } from "@/components/ui/card";
import { idleActionResult, type ActionResult } from "@/lib/crm/action-result";
import type { GoogleConnectionPublic } from "@/lib/integrations/google/types";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/dates";

type GoogleCalendarCardProps = {
  connection: GoogleConnectionPublic;
  flash?: string | null;
};

const FLASH_MESSAGES: Record<string, string> = {
  connected: "Compte Google connecté. Aucune donnée Google n'a été modifiée.",
  denied: "Connexion Google annulée.",
  invalid_state: "Session OAuth invalide. Réessayez.",
  error: "Échec de la connexion Google.",
  unconfigured: "Identifiants Google manquants côté serveur (.env).",
};

export function GoogleCalendarCard({ connection, flash }: GoogleCalendarCardProps) {
  const [calendars, setCalendars] = useState<GoogleCalendarOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [pullState, pullAction, pullPending] = useActionState(
    async () => syncGoogleCalendarPullAction(),
    idleActionResult,
  );
  const [pushState, pushAction, pushPending] = useActionState(
    async () => syncGoogleCalendarPushAction(),
    idleActionResult,
  );
  const [pushToggleState, pushToggleAction, pushTogglePending] = useActionState(
    setGooglePushEnabledAction,
    idleActionResult,
  );
  const [calendarState, calendarAction, calendarPending] = useActionState(
    setGoogleCalendarIdAction,
    idleActionResult,
  );
  const [disconnectState, disconnectAction, disconnectPending] = useActionState(
    async () => disconnectGoogleCalendarAction(),
    idleActionResult,
  );

  useEffect(() => {
    if (!connection.connected) {
      return;
    }
    startTransition(async () => {
      const result = await listSelectableGoogleCalendarsAction();
      if (!result.ok) {
        setLoadError(result.message);
        return;
      }
      setCalendars(result.calendars);
      setLoadError(null);
    });
  }, [connection.connected]);

  const statusMessage =
    (flash ? FLASH_MESSAGES[flash] : null) ??
    messageOf(pullState) ??
    messageOf(pushState) ??
    messageOf(pushToggleState) ??
    messageOf(calendarState) ??
    messageOf(disconnectState) ??
    loadError;

  return (
    <Card className="space-y-5 px-5 py-5">
      <div className="space-y-1.5">
        <h2 className="text-section text-foreground">Google Calendar</h2>
        <p className="text-body text-muted">
          Import en lecture depuis Google. Synchronisation optionnelle de vos RDV
          vers Google Calendar (notifications téléphone). Tokens chiffrés côté
          serveur.
        </p>
      </div>

      {statusMessage ? (
        <p className="rounded-xl border border-border bg-white/50 px-3 py-2 text-meta text-foreground">
          {statusMessage}
        </p>
      ) : null}

      {!connection.configured ? (
        <p className="text-body text-muted">
          Configurez <code className="font-mono text-meta">GOOGLE_CLIENT_ID</code>,{" "}
          <code className="font-mono text-meta">GOOGLE_CLIENT_SECRET</code> et{" "}
          <code className="font-mono text-meta">GOOGLE_REDIRECT_URI</code> dans{" "}
          <code className="font-mono text-meta">.env</code>, puis redémarrez le serveur.
        </p>
      ) : null}

      {!connection.connected ? (
        <div className="flex flex-wrap gap-2">
          {connection.configured ? (
            <a
              href="/api/integrations/google/oauth/start"
              className={cn(buttonVariants({ variant: "primary" }))}
            >
              <span className="relative z-10">Connecter Google</span>
            </a>
          ) : (
            <Button type="button" disabled>
              Connecter Google
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <dl className="grid gap-2 text-body sm:grid-cols-2">
            <div>
              <dt className="text-meta text-muted">Compte</dt>
              <dd className="font-medium text-foreground">
                {connection.googleAccountEmail ?? "Compte Google"}
              </dd>
            </div>
            <div>
              <dt className="text-meta text-muted">Dernière sync</dt>
              <dd className="font-medium text-foreground">
                {connection.lastSyncedAt
                  ? formatDateTime(connection.lastSyncedAt)
                  : "Jamais"}
              </dd>
            </div>
          </dl>

          <form action={calendarAction} className="space-y-2">
            <label className="block text-meta font-medium text-muted" htmlFor="google-calendar-id">
              Calendrier synchronisé
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                id="google-calendar-id"
                name="calendarId"
                defaultValue={connection.calendarId}
                className="min-h-11 w-full rounded-xl border border-border bg-white/70 px-3 text-body"
                disabled={pending || calendarPending || calendars.length === 0}
                onChange={(event) => {
                  const selected = calendars.find((c) => c.id === event.target.value);
                  const summaryInput = document.getElementById(
                    "google-calendar-summary",
                  ) as HTMLInputElement | null;
                  if (summaryInput) {
                    summaryInput.value = selected?.summary ?? "";
                  }
                }}
              >
                {calendars.length === 0 ? (
                  <option value={connection.calendarId}>
                    {connection.calendarSummary ?? connection.calendarId}
                  </option>
                ) : (
                  calendars.map((calendar) => (
                    <option key={calendar.id} value={calendar.id}>
                      {calendar.summary}
                      {calendar.primary ? " (principal)" : ""}
                    </option>
                  ))
                )}
              </select>
              <input
                id="google-calendar-summary"
                type="hidden"
                name="calendarSummary"
                defaultValue={connection.calendarSummary ?? ""}
              />
              <Button type="submit" variant="secondary" disabled={calendarPending}>
                Enregistrer
              </Button>
            </div>
          </form>

          <form action={pushToggleAction} className="space-y-2">
            <label className="flex min-h-11 items-start gap-2 text-body">
              <input
                type="checkbox"
                name="pushEnabled"
                defaultChecked={connection.pushEnabled}
                className="mt-1 size-4 rounded border-border"
              />
              <span>
                Synchroniser automatiquement mes RDV vers Google Calendar
                <span className="mt-0.5 block text-meta text-muted">
                  {connection.pushEnabled
                    ? "Activé — chaque nouveau ou modifié RDV apparaît dans Google (rappels téléphone inclus)."
                    : "Désactivé — aucun envoi automatique vers Google."}
                </span>
              </span>
            </label>
            <Button type="submit" variant="secondary" disabled={pushTogglePending}>
              Appliquer
            </Button>
          </form>

          <div className="flex flex-wrap gap-2">
            <form action={pullAction}>
              <Button type="submit" disabled={pullPending}>
                Synchroniser depuis Google
              </Button>
            </form>
            <form action={pushAction}>
              <Button
                type="submit"
                variant="secondary"
                disabled={pushPending || !connection.pushEnabled}
                title={
                  connection.pushEnabled
                    ? "Rattrapage des RDV en attente ou en erreur"
                    : "Activez d’abord la synchronisation automatique"
                }
              >
                Rattrapage manuel des RDV
              </Button>
            </form>
            <form action={disconnectAction}>
              <Button type="submit" variant="ghost" disabled={disconnectPending}>
                Déconnecter
              </Button>
            </form>
          </div>

          <p className="text-meta text-muted">
            Les suppressions dans Google ne sont jamais automatiques depuis VersaTech OS.
            Les événements importés depuis Google restent en lecture seule ici.
          </p>
        </div>
      )}
    </Card>
  );
}

function messageOf(state: ActionResult) {
  return state.message ?? null;
}
