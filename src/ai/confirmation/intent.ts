import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { SignJWT, errors, jwtVerify } from "jose";
import { z } from "zod";
import { getAuthSecret } from "@/lib/auth/config";
import { argsMatchSignedPayload, hashCanonicalArgs } from "./canonicalize";
import {
  CONFIRMABLE_WRITE_TOOL_NAMES,
  isConfirmableWriteToolName,
  parseConfirmableWriteArgs,
  type ConfirmableWriteArgs,
  type ConfirmableWriteToolName,
} from "./tools";

/** TTL inside the 5–10 minute window required by the confirmation protocol. */
export const ACTION_INTENT_TTL_SECONDS = 5 * 60;
export const WRITE_PROPOSAL_TTL_MS = ACTION_INTENT_TTL_SECONDS * 1000;

export const CONFIRM_TOKEN_TYP = "vt-ai-action";
export const CONFIRM_TOKEN_AUDIENCE = "versatech-ai.confirm";
export const CONFIRM_TOKEN_ISSUER = "versatech-os";

const actionIntentClaimsSchema = z.object({
  jti: z.string().min(1).max(64),
  actionId: z.string().min(1).max(64),
  toolName: z.enum(CONFIRMABLE_WRITE_TOOL_NAMES),
  args: z.unknown(),
  argsHash: z.string().min(32).max(128),
  humanSummary: z.string().min(1).max(180),
  actorBinding: z.string().min(32).max(128),
  createdAt: z.string().min(1),
  expiresAt: z.string().min(1),
});

export type ActionIntent = {
  actionId: string;
  toolName: ConfirmableWriteToolName;
  actorId: string;
  args: ConfirmableWriteArgs;
  humanSummary: string;
  createdAt: string;
  expiresAt: string;
};

export type SignedActionIntent = {
  actionId: string;
  toolName: ConfirmableWriteToolName;
  args: ConfirmableWriteArgs;
  argsHash: string;
  humanSummary: string;
  actorBinding: string;
  createdAt: string;
  expiresAt: string;
};

export type IntentClock = {
  now?: Date;
  secret?: string;
};

function encodeSecret(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

function resolveSecret(override?: string): string {
  if (override) {
    return override;
  }
  try {
    return getAuthSecret();
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      throw error;
    }
    // `tsx --test` does not load .env; production still requires AUTH_SECRET.
    return "versatech-os-ai-confirm-local-test-secret-32ch";
  }
}

function resolveNow(now?: Date): Date {
  return now ?? new Date();
}

/**
 * Keyed actor binding. Raw `actorId` stays off the client view and out of JWT
 * claims so a decoded compact JWS does not reveal the session user id.
 */
export function computeActorBinding(secret: string, actorId: string, actionId: string): string {
  return createHmac("sha256", secret)
    .update(`versatech-ai.confirm:actor:${actorId}:action:${actionId}`)
    .digest("hex");
}

function actorBindingMatches(
  secret: string,
  actorId: string,
  actionId: string,
  expected: string,
): boolean {
  const actual = computeActorBinding(secret, actorId, actionId);
  const left = Buffer.from(actual, "hex");
  const right = Buffer.from(expected, "hex");
  if (left.length === 0 || left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

export type SignActionIntentInput = {
  actionId: string;
  actorId: string;
  toolName: ConfirmableWriteToolName;
  args: ConfirmableWriteArgs;
  humanSummary: string;
  createdAt: Date;
  expiresAt: Date;
  secret?: string;
};

export async function signActionIntent(input: SignActionIntentInput): Promise<string> {
  const secret = resolveSecret(input.secret);
  const createdAt = input.createdAt.toISOString();
  const expiresAt = input.expiresAt.toISOString();
  const argsHash = hashCanonicalArgs(input.args);
  const actorBinding = computeActorBinding(secret, input.actorId, input.actionId);

  return new SignJWT({
    actionId: input.actionId,
    toolName: input.toolName,
    args: input.args,
    argsHash,
    humanSummary: input.humanSummary,
    actorBinding,
    createdAt,
    expiresAt,
  })
    .setProtectedHeader({ alg: "HS256", typ: CONFIRM_TOKEN_TYP })
    .setJti(input.actionId)
    .setIssuedAt(input.createdAt)
    .setExpirationTime(input.expiresAt)
    .setAudience(CONFIRM_TOKEN_AUDIENCE)
    .setIssuer(CONFIRM_TOKEN_ISSUER)
    .sign(encodeSecret(secret));
}

export type VerifyIntentFailureCode = "INVALID" | "EXPIRED";

export type VerifySignedIntentResult =
  | { ok: true; intent: SignedActionIntent }
  | { ok: false; code: VerifyIntentFailureCode };

export async function verifySignedIntent(
  token: string,
  clock: IntentClock = {},
): Promise<VerifySignedIntentResult> {
  if (!token || token.length > 8192) {
    return { ok: false, code: "INVALID" };
  }

  const secret = resolveSecret(clock.secret);
  const now = resolveNow(clock.now);

  try {
    const { payload, protectedHeader } = await jwtVerify(token, encodeSecret(secret), {
      algorithms: ["HS256"],
      audience: CONFIRM_TOKEN_AUDIENCE,
      issuer: CONFIRM_TOKEN_ISSUER,
      typ: CONFIRM_TOKEN_TYP,
      currentDate: now,
      requiredClaims: [
        "jti",
        "actionId",
        "toolName",
        "args",
        "argsHash",
        "humanSummary",
        "actorBinding",
        "createdAt",
        "expiresAt",
      ],
    });

    if (protectedHeader.alg !== "HS256" || protectedHeader.typ !== CONFIRM_TOKEN_TYP) {
      return { ok: false, code: "INVALID" };
    }

    const parsed = actionIntentClaimsSchema.safeParse(payload);
    if (!parsed.success) {
      return { ok: false, code: "INVALID" };
    }

    const claims = parsed.data;
    if (claims.jti !== claims.actionId) {
      return { ok: false, code: "INVALID" };
    }
    if (!isConfirmableWriteToolName(claims.toolName)) {
      return { ok: false, code: "INVALID" };
    }

    const normalized = parseConfirmableWriteArgs(claims.toolName, claims.args);
    if (!normalized.ok) {
      return { ok: false, code: "INVALID" };
    }
    if (!argsMatchSignedPayload(claims.args, normalized.args)) {
      return { ok: false, code: "INVALID" };
    }
    if (hashCanonicalArgs(normalized.args) !== claims.argsHash) {
      return { ok: false, code: "INVALID" };
    }

    const expiresAtMs = Date.parse(claims.expiresAt);
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now.getTime()) {
      return { ok: false, code: "EXPIRED" };
    }

    return {
      ok: true,
      intent: {
        actionId: claims.actionId,
        toolName: claims.toolName,
        args: normalized.args,
        argsHash: claims.argsHash,
        humanSummary: claims.humanSummary,
        actorBinding: claims.actorBinding,
        createdAt: claims.createdAt,
        expiresAt: claims.expiresAt,
      },
    };
  } catch (error) {
    if (error instanceof errors.JWTExpired) {
      return { ok: false, code: "EXPIRED" };
    }
    return { ok: false, code: "INVALID" };
  }
}

export function bindIntentToActor(
  intent: SignedActionIntent,
  actorId: string,
  secret?: string,
): ActionIntent | null {
  const resolved = resolveSecret(secret);
  if (!actorBindingMatches(resolved, actorId, intent.actionId, intent.actorBinding)) {
    return null;
  }
  return {
    actionId: intent.actionId,
    toolName: intent.toolName,
    actorId,
    args: intent.args,
    humanSummary: intent.humanSummary,
    createdAt: intent.createdAt,
    expiresAt: intent.expiresAt,
  };
}
