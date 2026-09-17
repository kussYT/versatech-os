import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthSecret, LOGIN_PATH, SESSION_COOKIE_NAME } from "@/lib/auth/config";
import { isLoginPath, isPublicPath, safeRedirectPath } from "@/lib/auth/paths";
import { verifySessionToken } from "@/lib/auth/token";
import {
  PATHNAME_HEADER,
  applyApplicationSecurityHeaders,
  contentSecurityPolicy,
  createRequestNonce,
} from "@/lib/security/headers";

function withSecurityHeaders(response: NextResponse, nonce: string) {
  applyApplicationSecurityHeaders(response.headers, nonce);
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const nonce = createRequestNonce();
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token
    ? await verifySessionToken(token, getAuthSecret())
    : null;
  const authenticated = Boolean(session);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(PATHNAME_HEADER, pathname);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy(nonce));

  if (!authenticated && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = LOGIN_PATH;
    loginUrl.search = "";
    loginUrl.searchParams.set("from", pathname);
    return withSecurityHeaders(NextResponse.redirect(loginUrl), nonce);
  }

  if (authenticated && isLoginPath(pathname)) {
    const destination = safeRedirectPath(request.nextUrl.searchParams.get("from"));
    return withSecurityHeaders(
      NextResponse.redirect(new URL(destination, request.url)),
      nonce,
    );
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  return withSecurityHeaders(response, nonce);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
