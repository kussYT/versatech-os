import "server-only";

import type { SessionUser } from "@/lib/auth/types";

export type RequestActorResult =
  | { ok: true; actor: SessionUser }
  | { ok: false; code: "AUTH_REQUIRED" };

export function requestActorFromSession(
  user: SessionUser | null,
): RequestActorResult {
  if (!user) {
    return { ok: false, code: "AUTH_REQUIRED" };
  }

  return {
    ok: true,
    actor: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
}

export async function requireRequestActor(): Promise<RequestActorResult> {
  const { getSessionUser } = await import("@/lib/auth/session");
  return requestActorFromSession(await getSessionUser());
}
