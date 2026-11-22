import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { GOOGLE_OAUTH_STATE_COOKIE } from "@/lib/integrations/google/config";
import { saveGoogleConnectionFromCode } from "@/lib/integrations/google/connection";
import { verifyOAuthState } from "@/lib/integrations/google/oauth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(new URL("/connexion?from=/parametres", origin));
  }

  const error = request.nextUrl.searchParams.get("error");
  if (error) {
    return redirectParametres(origin, "denied");
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookieState = request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;

  if (!code || !state || !cookieState || state !== cookieState) {
    return redirectParametres(origin, "invalid_state");
  }

  if (!verifyOAuthState(state, user.id)) {
    return redirectParametres(origin, "invalid_state");
  }

  const saved = await saveGoogleConnectionFromCode({ userId: user.id, code });
  const response = redirectParametres(
    origin,
    saved.ok ? "connected" : "error",
  );
  response.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
  return response;
}

function redirectParametres(origin: string, google: string) {
  const url = new URL("/parametres", origin);
  url.searchParams.set("google", google);
  return NextResponse.redirect(url);
}
