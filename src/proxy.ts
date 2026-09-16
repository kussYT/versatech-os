import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthSecret, LOGIN_PATH, SESSION_COOKIE_NAME } from "@/lib/auth/config";
import { isPublicPath, safeRedirectPath } from "@/lib/auth/paths";
import { verifySessionToken } from "@/lib/auth/token";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token
    ? await verifySessionToken(token, getAuthSecret())
    : null;
  const authenticated = Boolean(session);

  if (!authenticated && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = LOGIN_PATH;
    loginUrl.search = "";
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (authenticated && isPublicPath(pathname)) {
    const destination = safeRedirectPath(request.nextUrl.searchParams.get("from"));
    return NextResponse.redirect(new URL(destination, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
