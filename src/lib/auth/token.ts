import { SignJWT, jwtVerify } from "jose";

export type SessionTokenPayload = {
  sub: string;
};

export async function createSessionToken(
  userId: string,
  secret: string,
  ttlSeconds: number,
) {
  return new SignJWT({ sub: userId })
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

    return { sub: payload.sub };
  } catch {
    return null;
  }
}
