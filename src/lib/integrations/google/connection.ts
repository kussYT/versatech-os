import "server-only";

import { prisma } from "@/lib/db/prisma";
import {
  getGoogleOAuthConfig,
  isGoogleOAuthConfigured,
  GOOGLE_PROVIDER,
} from "@/lib/integrations/google/config";
import { decryptSecret, encryptSecret } from "@/lib/integrations/google/crypto";
import {
  exchangeAuthorizationCode,
  fetchGoogleUserInfo,
  refreshAccessToken,
  type GoogleTokenSet,
} from "@/lib/integrations/google/oauth";
import { listGoogleCalendars } from "@/lib/integrations/google/calendar-api";
import { logServerError } from "@/lib/observability/log-error";
import type { GoogleConnectionPublic } from "@/lib/integrations/google/types";

export type { GoogleConnectionPublic };

export async function getGoogleConnectionPublic(
  userId: string,
): Promise<GoogleConnectionPublic> {
  const configured = isGoogleOAuthConfigured();
  const row = await prisma.googleCalendarConnection.findUnique({
    where: { userId },
    select: {
      googleAccountEmail: true,
      calendarId: true,
      calendarSummary: true,
      pushEnabled: true,
      lastSyncedAt: true,
    },
  });

  return {
    configured,
    connected: Boolean(row),
    googleAccountEmail: row?.googleAccountEmail ?? null,
    calendarId: row?.calendarId ?? "primary",
    calendarSummary: row?.calendarSummary ?? null,
    pushEnabled: row?.pushEnabled ?? false,
    lastSyncedAt: row?.lastSyncedAt?.toISOString() ?? null,
  };
}

export async function saveGoogleConnectionFromCode(input: {
  userId: string;
  code: string;
}) {
  const config = getGoogleOAuthConfig();
  if (!config) {
    return { ok: false as const, message: "Google OAuth n'est pas configuré." };
  }

  try {
    const tokens = await exchangeAuthorizationCode(input.code, config);
    const userInfo = await fetchGoogleUserInfo(tokens.accessToken);
    const calendars = await listGoogleCalendars(tokens.accessToken);
    const primary =
      calendars.ok
        ? calendars.data.find((c) => c.primary) ?? calendars.data[0] ?? null
        : null;

    await prisma.googleCalendarConnection.upsert({
      where: { userId: input.userId },
      create: {
        userId: input.userId,
        googleAccountEmail: userInfo.email,
        googleAccountSub: userInfo.sub,
        calendarId: primary?.id ?? "primary",
        calendarSummary: primary?.summary ?? "Primary",
        accessTokenEnc: encryptSecret(tokens.accessToken),
        refreshTokenEnc: tokens.refreshToken
          ? encryptSecret(tokens.refreshToken)
          : null,
        tokenExpiresAt: tokens.expiresAt,
        scopes: tokens.scopes,
        pushEnabled: false,
        syncToken: null,
        lastSyncedAt: null,
      },
      update: {
        googleAccountEmail: userInfo.email,
        googleAccountSub: userInfo.sub,
        calendarId: primary?.id ?? "primary",
        calendarSummary: primary?.summary ?? "Primary",
        accessTokenEnc: encryptSecret(tokens.accessToken),
        refreshTokenEnc: tokens.refreshToken
          ? encryptSecret(tokens.refreshToken)
          : undefined,
        tokenExpiresAt: tokens.expiresAt,
        scopes: tokens.scopes,
        // First (re)connect: no Google writes, reset sync cursor for a clean pull.
        syncToken: null,
        pushEnabled: false,
      },
    });

    await prisma.activityLog.create({
      data: {
        actorId: input.userId,
        entityType: "GoogleCalendarConnection",
        entityId: input.userId,
        action: "google_calendar.connected",
        metadata: {
          email: userInfo.email,
          calendarId: primary?.id ?? "primary",
          provider: GOOGLE_PROVIDER,
        },
      },
    });

    return { ok: true as const };
  } catch (error) {
    logServerError("google.oauth.save", error);
    return {
      ok: false as const,
      message: "Impossible de finaliser la connexion Google.",
    };
  }
}

export async function disconnectGoogleCalendar(userId: string) {
  const existing = await prisma.googleCalendarConnection.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!existing) {
    return { ok: true as const };
  }

  await prisma.$transaction(async (tx) => {
    await tx.googleCalendarConnection.delete({ where: { userId } });
    await tx.activityLog.create({
      data: {
        actorId: userId,
        entityType: "GoogleCalendarConnection",
        entityId: userId,
        action: "google_calendar.disconnected",
        metadata: { provider: GOOGLE_PROVIDER },
      },
    });
  });

  return { ok: true as const };
}

export async function setGooglePushEnabled(userId: string, pushEnabled: boolean) {
  const row = await prisma.googleCalendarConnection.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!row) {
    return { ok: false as const, message: "Compte Google non connecté." };
  }

  await prisma.googleCalendarConnection.update({
    where: { userId },
    data: { pushEnabled },
  });

  await prisma.activityLog.create({
    data: {
      actorId: userId,
      entityType: "GoogleCalendarConnection",
      entityId: userId,
      action: pushEnabled
        ? "google_calendar.push_enabled"
        : "google_calendar.push_disabled",
      metadata: { provider: GOOGLE_PROVIDER },
    },
  });

  return { ok: true as const };
}

export async function setGoogleCalendarId(
  userId: string,
  calendarId: string,
  calendarSummary: string | null,
) {
  const row = await prisma.googleCalendarConnection.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!row) {
    return { ok: false as const, message: "Compte Google non connecté." };
  }

  await prisma.googleCalendarConnection.update({
    where: { userId },
    data: {
      calendarId,
      calendarSummary,
      syncToken: null,
    },
  });

  return { ok: true as const };
}

export async function getValidAccessToken(userId: string): Promise<
  | { ok: true; accessToken: string; calendarId: string; pushEnabled: boolean }
  | { ok: false; message: string }
> {
  const config = getGoogleOAuthConfig();
  if (!config) {
    return { ok: false, message: "Google OAuth n'est pas configuré." };
  }

  const row = await prisma.googleCalendarConnection.findUnique({
    where: { userId },
  });
  if (!row) {
    return { ok: false, message: "Compte Google non connecté." };
  }

  const stillValid =
    row.tokenExpiresAt &&
    row.tokenExpiresAt.getTime() > Date.now() + 60_000;

  if (stillValid) {
    return {
      ok: true,
      accessToken: decryptSecret(row.accessTokenEnc),
      calendarId: row.calendarId,
      pushEnabled: row.pushEnabled,
    };
  }

  if (!row.refreshTokenEnc) {
    return {
      ok: false,
      message: "Session Google expirée. Reconnectez le compte.",
    };
  }

  try {
    const refreshed = await refreshAccessToken(
      decryptSecret(row.refreshTokenEnc),
      config,
    );
    await persistRefreshedTokens(userId, refreshed);
    return {
      ok: true,
      accessToken: refreshed.accessToken,
      calendarId: row.calendarId,
      pushEnabled: row.pushEnabled,
    };
  } catch (error) {
    logServerError("google.oauth.refresh", error);
    return {
      ok: false,
      message: "Impossible de renouveler le jeton Google.",
    };
  }
}

async function persistRefreshedTokens(userId: string, tokens: GoogleTokenSet) {
  await prisma.googleCalendarConnection.update({
    where: { userId },
    data: {
      accessTokenEnc: encryptSecret(tokens.accessToken),
      refreshTokenEnc: tokens.refreshToken
        ? encryptSecret(tokens.refreshToken)
        : undefined,
      tokenExpiresAt: tokens.expiresAt,
      scopes: tokens.scopes,
    },
  });
}
