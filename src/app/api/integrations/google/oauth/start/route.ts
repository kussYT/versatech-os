import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import {
  GOOGLE_OAUTH_STATE_COOKIE,
  GOOGLE_OAUTH_STATE_TTL_SECONDS,
  getGoogleOAuthConfig,
} from "@/lib/integrations/google/config";
import { buildGoogleAuthUrl, createOAuthState } from "@/lib/integrations/google/oauth";
import { sessionCookieOptions } from "@/lib/auth/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(new URL("/connexion?from=/parametres", absoluteOrigin()));
  }

  const config = getGoogleOAuthConfig();
  if (!config) {
    return NextResponse.redirect(
      new URL("/parametres?google=unconfigured", absoluteOrigin()),
    );
  }

  const state = createOAuthState(user.id);
  const url = buildGoogleAuthUrl(state, config);
  const response = NextResponse.redirect(url);
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
    ...sessionCookieOptions(GOOGLE_OAUTH_STATE_TTL_SECONDS),
    sameSite: "lax",
  });
  return response;
}

function absoluteOrigin() {
  const fromEnv = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (fromEnv) {
    try {
      return new URL(fromEnv).origin;
    } catch {
      // fall through
    }
  }
  return process.env.NODE_ENV === "production"
    ? "https://localhost"
    : "http://localhost:3000";
}
