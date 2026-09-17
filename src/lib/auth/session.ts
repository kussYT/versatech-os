import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import {
  getAuthSecret,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  sessionCookieOptions,
} from "@/lib/auth/config";
import { isCurrentSessionVersion } from "@/lib/auth/session-version";
import { createSessionToken, verifySessionToken } from "@/lib/auth/token";
import type { SessionUser } from "@/lib/auth/types";
import { prisma } from "@/lib/db/prisma";

export const actorUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  sessionVersion: true,
} as const;

export type { SessionUser };

export async function createSession(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { sessionVersion: true },
  });

  if (!user) {
    throw new Error("Cannot create a session for an unknown user.");
  }

  const token = await createSessionToken(
    userId,
    user.sessionVersion,
    getAuthSecret(),
    SESSION_TTL_SECONDS,
  );
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    ...sessionCookieOptions(0),
    expires: new Date(0),
  });
}

export async function invalidateUserSessions(userId: string) {
  await prisma.user.updateMany({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
  });
}

export async function readSessionUserId(token: string | undefined) {
  if (!token) {
    return null;
  }

  const payload = await verifySessionToken(token, getAuthSecret());
  return payload?.sub ?? null;
}

function toSessionUser(user: {
  id: string;
  name: string;
  email: string;
  role: SessionUser["role"];
}): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  const payload = await verifySessionToken(token, getAuthSecret());
  if (!payload) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: actorUserSelect,
  });

  if (!user || !isCurrentSessionVersion(payload.sessionVersion, user.sessionVersion)) {
    return null;
  }

  return toSessionUser(user);
});
