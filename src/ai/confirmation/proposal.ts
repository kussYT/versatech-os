import "server-only";

import { TOOL_ERROR_MESSAGES } from "@/ai/result";
import type { SessionUser } from "@/lib/auth/types";
import { ACTION_INTENT_TTL_SECONDS, signActionIntent } from "./intent";
import {
  humanSummaryForWrite,
  isConfirmableWriteToolName,
  isCriticalToolName,
  parseConfirmableWriteArgs,
  type ConfirmableWriteArgs,
  type ConfirmableWriteToolName,
} from "./tools";

export type WriteProposalView = {
  actionId: string;
  toolName: ConfirmableWriteToolName;
  humanSummary: string;
  expiresAt: string;
};

export type CreateWriteProposalInput = {
  actor: Pick<SessionUser, "id">;
  toolName: string;
  args: unknown;
  humanSummary?: string;
  /** Test-only override. Production omits this and uses ACTION_INTENT_TTL_SECONDS. */
  ttlMs?: number;
};

export type CreateWriteProposalDeps = {
  secret?: string;
  now?: Date;
  ttlSeconds?: number;
  actionId?: string;
};

export type CreateWriteProposalResult =
  | {
      ok: true;
      token: string;
      view: WriteProposalView;
      args: ConfirmableWriteArgs;
      createdAt: string;
    }
  | {
      ok: false;
      code: "AUTH_REQUIRED" | "FORBIDDEN" | "VALIDATION_FAILED";
      message: string;
    };

function sanitizeSummary(value: string | undefined, fallback: string): string {
  if (!value) {
    return fallback;
  }
  const oneLine = value.replace(/[\n\r\t]+/g, " ").trim().slice(0, 180);
  if (!oneLine || /AUTH_SECRET|DATABASE_URL|passwordHash/i.test(oneLine)) {
    return fallback;
  }
  return oneLine;
}

/**
 * Signs a pending WRITE proposal. The LLM cannot confirm: this only issues a
 * server token. CRITICAL and non-allowlisted names are refused here.
 *
 * `{ actor, toolName, args }` → `{ token, view: { actionId, toolName, humanSummary, expiresAt } }`
 */
export async function createWriteProposal(
  input: CreateWriteProposalInput,
  deps: CreateWriteProposalDeps = {},
): Promise<CreateWriteProposalResult> {
  const actorId = input.actor?.id?.trim();
  if (!actorId) {
    return { ok: false, code: "AUTH_REQUIRED", message: TOOL_ERROR_MESSAGES.AUTH_REQUIRED };
  }

  if (isCriticalToolName(input.toolName) || !isConfirmableWriteToolName(input.toolName)) {
    return { ok: false, code: "FORBIDDEN", message: TOOL_ERROR_MESSAGES.FORBIDDEN };
  }

  const parsed = parseConfirmableWriteArgs(input.toolName, input.args);
  if (!parsed.ok) {
    return { ok: false, code: "VALIDATION_FAILED", message: TOOL_ERROR_MESSAGES.VALIDATION_FAILED };
  }

  const requestedSeconds =
    deps.ttlSeconds ??
    (typeof input.ttlMs === "number" && Number.isFinite(input.ttlMs)
      ? Math.floor(input.ttlMs / 1000)
      : ACTION_INTENT_TTL_SECONDS);
  const ttlSeconds = Math.min(10 * 60, Math.max(0, requestedSeconds));

  const createdAt = deps.now ?? new Date();
  const expiresAt = new Date(createdAt.getTime() + ttlSeconds * 1000);
  const actionId = deps.actionId ?? crypto.randomUUID();
  const generated = humanSummaryForWrite(input.toolName, parsed.args);
  const humanSummary = sanitizeSummary(input.humanSummary, generated);

  let token: string;
  try {
    token = await signActionIntent({
      actionId,
      actorId,
      toolName: input.toolName,
      args: parsed.args,
      humanSummary,
      createdAt,
      expiresAt,
      secret: deps.secret,
    });
  } catch {
    return { ok: false, code: "FORBIDDEN", message: TOOL_ERROR_MESSAGES.FORBIDDEN };
  }

  return {
    ok: true,
    token,
    view: {
      actionId,
      toolName: input.toolName,
      humanSummary,
      expiresAt: expiresAt.toISOString(),
    },
    args: parsed.args,
    createdAt: createdAt.toISOString(),
  };
}
