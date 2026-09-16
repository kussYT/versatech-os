import type { SessionUser } from "@/lib/auth/types";
import type { ActionResult } from "@/lib/crm/action-result";

export const AUTH_REQUIRED_RESULT: ActionResult = {
  ok: false,
  message: "Authentification requise.",
};

export type ActorRef = SessionUser;

export function actorOrUnauthorized(
  actor: SessionUser | null,
): { ok: true; actor: SessionUser } | { ok: false; result: ActionResult } {
  if (!actor) {
    return { ok: false, result: AUTH_REQUIRED_RESULT };
  }

  return { ok: true, actor };
}
