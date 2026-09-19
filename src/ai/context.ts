import "server-only";

import type { RequestActorResult } from "@/lib/auth/request-actor";
import type { SessionUser } from "@/lib/auth/types";

export type UserRole = SessionUser["role"];

/**
 * Reserved for WRITE / CRITICAL. Issued by the server, never taken from
 * model JSON, prompts, or tool arguments.
 */
export type ToolConfirmation = {
  token: string;
  toolName: string;
  argsHash: string;
};

/**
 * Model-facing metadata. No email, no name, no SessionUser.
 * `confirmation` is omitted unless a later server API attaches it.
 */
export type ToolContext = {
  actorId: string;
  role: UserRole;
  requestId: string;
  source: "AI";
  confirmation?: ToolConfirmation;
};

/**
 * Server-only runtime. Holds the full `SessionUser` for business services.
 * Never pass this object as a tool argument or prompt fragment.
 */
export type ToolRuntime = {
  actor: SessionUser;
  requestId: string;
  source: "AI";
};

export type CreateToolRuntimeResult =
  | { ok: true; runtime: ToolRuntime }
  | { ok: false; code: "AUTH_REQUIRED" };

function isRequestActorResult(
  value: SessionUser | RequestActorResult,
): value is RequestActorResult {
  return "ok" in value && typeof value.ok === "boolean";
}

function sanitizeActor(user: SessionUser): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

function resolveActor(source: SessionUser | RequestActorResult): SessionUser | null {
  if (isRequestActorResult(source)) {
    if (!source.ok) {
      return null;
    }
    return sanitizeActor(source.actor);
  }

  if (!source.id) {
    return null;
  }

  return sanitizeActor(source);
}

function resolveRequestId(requestId: string): string {
  const trimmed = requestId.trim();
  return trimmed.length > 0 ? trimmed : crypto.randomUUID();
}

/**
 * Build a ToolRuntime from the session actor only.
 * Extra fields (`actorId`, `passwordHash`, `source`, `confirmation`, …) are dropped.
 * `requestId` is a server correlation id — never read from tool input JSON.
 */
export function createToolRuntime(
  actorSource: SessionUser | RequestActorResult,
  requestId: string,
): CreateToolRuntimeResult {
  const actor = resolveActor(actorSource);
  if (!actor) {
    return { ok: false, code: "AUTH_REQUIRED" };
  }

  return {
    ok: true,
    runtime: {
      actor,
      requestId: resolveRequestId(requestId),
      source: "AI",
    },
  };
}

/** Derive model-visible context. SessionUser stays on the runtime. */
export function toToolContext(runtime: ToolRuntime): ToolContext {
  return {
    actorId: runtime.actor.id,
    role: runtime.actor.role,
    requestId: runtime.requestId,
    source: "AI",
  };
}
