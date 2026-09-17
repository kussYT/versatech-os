import "server-only";

import { redirect } from "next/navigation";
import { LOGIN_PATH } from "@/lib/auth/config";
import { getSessionUser } from "@/lib/auth/session";
import type { SessionUser } from "@/lib/auth/types";

export async function requireAuthenticatedUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect(LOGIN_PATH);
  }

  return user;
}
