const ILLUSTRATIVE_AUTH_SECRET =
  "replace-me-with-a-random-string-of-at-least-32-chars";

export const SESSION_COOKIE_NAME = "vt_os_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
export const LOGIN_PATH = "/connexion";
export const DEFAULT_AFTER_LOGIN_PATH = "/";

export function isIllustrativeAuthSecret(secret: string) {
  return secret.trim() === ILLUSTRATIVE_AUTH_SECRET;
}

export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim();

  if (!secret) {
    throw new Error(
      "AUTH_SECRET is missing. Copy .env.example to .env and set a random value (openssl rand -base64 32).",
    );
  }

  if (secret.length < 32) {
    throw new Error("AUTH_SECRET must be at least 32 characters.");
  }

  if (process.env.NODE_ENV === "production" && isIllustrativeAuthSecret(secret)) {
    throw new Error(
      "AUTH_SECRET still uses the illustrative .env.example value. Generate a unique secret before production.",
    );
  }

  return secret;
}

export function sessionCookieOptions(maxAgeSeconds = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
