import "server-only";

import { createHash, randomBytes } from "node:crypto";
import {
  GOOGLE_AUTH_URL,
  GOOGLE_OAUTH_SCOPES,
  GOOGLE_TOKEN_URL,
  GOOGLE_USERINFO_URL,
  getGoogleOAuthConfig,
  type GoogleOAuthConfig,
} from "@/lib/integrations/google/config";

const REQUEST_TIMEOUT_MS = 10_000;

export type GoogleTokenSet = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scopes: string;
};

export type GoogleUserInfo = {
  sub: string;
  email: string | null;
};

export function createOAuthState(userId: string) {
  const nonce = randomBytes(24).toString("base64url");
  const payload = `${userId}.${nonce}`;
  const sig = signState(payload);
  return `${payload}.${sig}`;
}

export function verifyOAuthState(state: string, expectedUserId: string) {
  const parts = state.split(".");
  if (parts.length !== 3) {
    return false;
  }
  const [userId, nonce, sig] = parts;
  if (!userId || !nonce || !sig || userId !== expectedUserId) {
    return false;
  }
  const payload = `${userId}.${nonce}`;
  return timingSafeEqual(sig, signState(payload));
}

function signState(payload: string) {
  const config = getGoogleOAuthConfig();
  const material = `${payload}:${config?.clientSecret ?? "unconfigured"}`;
  return createHash("sha256").update(material).digest("base64url");
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < left.length; i += 1) {
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return mismatch === 0;
}

export function buildGoogleAuthUrl(state: string, config: GoogleOAuthConfig) {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_OAUTH_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeAuthorizationCode(
  code: string,
  config: GoogleOAuthConfig,
): Promise<GoogleTokenSet> {
  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
  });

  const json = await postToken(body);
  return parseTokenResponse(json);
}

export async function refreshAccessToken(
  refreshToken: string,
  config: GoogleOAuthConfig,
): Promise<GoogleTokenSet> {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "refresh_token",
  });

  const json = await postToken(body);
  const parsed = parseTokenResponse(json);
  return {
    ...parsed,
    refreshToken: parsed.refreshToken ?? refreshToken,
  };
}

export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Google userinfo failed (${response.status}).`);
  }

  const json = (await response.json()) as { sub?: string; email?: string };
  if (!json.sub) {
    throw new Error("Google userinfo missing sub.");
  }

  return {
    sub: json.sub,
    email: json.email?.trim() || null,
  };
}

async function postToken(body: URLSearchParams) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Google token exchange failed (${response.status}).`);
  }

  return (await response.json()) as Record<string, unknown>;
}

function parseTokenResponse(json: Record<string, unknown>): GoogleTokenSet {
  const accessToken = typeof json.access_token === "string" ? json.access_token : null;
  if (!accessToken) {
    throw new Error("Google token response missing access_token.");
  }

  const refreshToken =
    typeof json.refresh_token === "string" ? json.refresh_token : null;
  const expiresIn =
    typeof json.expires_in === "number"
      ? json.expires_in
      : typeof json.expires_in === "string"
        ? Number(json.expires_in)
        : null;
  const scope =
    typeof json.scope === "string" ? json.scope : GOOGLE_OAUTH_SCOPES.join(" ");

  return {
    accessToken,
    refreshToken,
    expiresAt:
      expiresIn && Number.isFinite(expiresIn)
        ? new Date(Date.now() + expiresIn * 1000)
        : null,
    scopes: scope,
  };
}
