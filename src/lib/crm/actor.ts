import "server-only";

import { AUTH_REQUIRED_RESULT, actorOrUnauthorized } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/session";

export { AUTH_REQUIRED_RESULT };

export async function getActorUser() {
  return getSessionUser();
}

export async function requireActor() {
  return actorOrUnauthorized(await getActorUser());
}
