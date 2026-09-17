import { SignJWT, jwtVerify } from "jose";
import {
  SESSION_VERSION_CLAIM,
  readSessionVersionClaim,
} from "@/lib/auth/session-version";

export type SessionTokenPayload = {
  sub: string;
  sessionVersion: number;
};

export async function createSessionToken(
  userId: string,
  sessionVersion: number,
  secret: string,
  ttlSeconds: number,
) {
  return new SignJWT({ [SESSION_VERSION_CLAIM]: sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(new TextEncoder().encode(secret));
}

export async function verifySessionToken(
  token: string,
  secret: string,
): Promise<SessionTokenPayload | null> {
  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ["HS256"],
    });

    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      return null;
    }

    const sessionVersion = readSessionVersionClaim(payload[SESSION_VERSION_CLAIM]);
    if (sessionVersion === null) {
      return null;
    }

    return { sub: payload.sub, sessionVersion };
  } catch {
    return null;
  }
}
