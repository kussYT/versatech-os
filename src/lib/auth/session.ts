import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import {
  getAuthSecret,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  sessionCookieOptions,
} from "@/lib/auth/config";
import { createSessionToken, verifySessionToken } from "@/lib/auth/token";
import type { SessionUser } from "@/lib/auth/types";
import { prisma } from "@/lib/db/prisma";

export const actorUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
} as const;

export type { SessionUser };

export async function createSession(userId: string) {
  const token = await createSessionToken(
    userId,
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

export async function readSessionUserId(token: string | undefined) {
  if (!token) {
    return null;
  }

  const payload = await verifySessionToken(token, getAuthSecret());
  return payload?.sub ?? null;
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const userId = await readSessionUserId(token);
  if (!userId) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: userId },
    select: actorUserSelect,
  });
});
