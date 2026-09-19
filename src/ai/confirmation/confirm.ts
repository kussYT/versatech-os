import "server-only";

import { z } from "zod";
import { isSafeToolMessage, toolSuccess, type ToolResult } from "@/ai/result";
import type { SessionUser } from "@/lib/auth/types";
import { ALREADY_CONSUMED, isAlreadyConsumedError } from "@/lib/services/ai-action-consumption/errors";
import { executeConfirmedWrite, toConfirmedWriteInput, type ExecuteConfirmedWrite } from "./execute";
import { bindIntentToActor, verifySignedIntent } from "./intent";
import { createWriteProposal } from "./proposal";
import { isConfirmableWriteToolName, isCriticalToolName } from "./tools";

export const CONFIRM_TOKEN_MAX_LENGTH = 8192;

export const CONFIRM_ERROR_MESSAGES = {
  AUTH_REQUIRED: "Authentification requise.",
  INVALID_REQUEST: "Requête invalide.",
  FORBIDDEN: "Confirmation refusée.",
  EXPIRED: "Confirmation expirée.",
  CONSUMED: "Cette action a déjà été confirmée.",
  UNAVAILABLE: "Action indisponible.",
} as const;

const confirmationTokenSchema = z.string().trim().min(1).max(CONFIRM_TOKEN_MAX_LENGTH);

/**
 * POST /api/ai/actions/confirm body.
 * `{ token }` only. Extra keys such as `toolName`, `args`, `confirmed`,
 * `actionId`, and `confirmation` are stripped and never executed.
 */
export const confirmActionBodySchema = z.object({
  token: confirmationTokenSchema,
});

export type ConfirmActionBody = z.infer<typeof confirmActionBodySchema>;

export function extractConfirmToken(body: ConfirmActionBody): string | null {
  const token = body.token?.trim() ?? "";
  return token.length > 0 ? token : null;
}

function isReplayError(error: unknown): boolean {
  if (isAlreadyConsumedError(error)) {
    return true;
  }
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: unknown }).code === ALREADY_CONSUMED,
  );
}

export type ConfirmWriteDeps = {
  secret?: string;
  now?: Date;
  execute?: ExecuteConfirmedWrite;
};

export type ConfirmWriteSuccess = {
  ok: true;
  actionId: string;
  toolName: string;
  data: unknown;
};

export type ConfirmWriteFailure = {
  ok: false;
  status: 400 | 401 | 403 | 409 | 410 | 500;
  message: string;
};

export type ConfirmWriteResult = ConfirmWriteSuccess | ConfirmWriteFailure;

function httpFailureFromToolResult(
  result: Extract<ToolResult, { success: false }>,
): ConfirmWriteFailure {
  const code = result.error.code;
  if (code === "AUTH_REQUIRED") {
    return { ok: false, status: 401, message: CONFIRM_ERROR_MESSAGES.AUTH_REQUIRED };
  }
  if (code === "FORBIDDEN") {
    return { ok: false, status: 403, message: CONFIRM_ERROR_MESSAGES.FORBIDDEN };
  }
  if (code === "INTERNAL" || code === "SERVICE_UNAVAILABLE" || code === "NOT_IMPLEMENTED") {
    return { ok: false, status: 500, message: CONFIRM_ERROR_MESSAGES.UNAVAILABLE };
  }
  const message =
    isSafeToolMessage(result.error.message) && result.error.message
      ? result.error.message
      : CONFIRM_ERROR_MESSAGES.UNAVAILABLE;
  return { ok: false, status: 400, message };
}

/**
 * Server confirmation. The model cannot confirm: only a signed token bound to
 * the session actor is accepted. Client `toolName` / `args` are ignored.
 *
 * Replay is NOT decided here. PostgreSQL UNIQUE (`claimAiActionConsumption`)
 * inside `runConfirmedWrite` is the anti-replay authority.
 */
export async function confirmWriteAction(
  actor: SessionUser,
  token: string,
  deps: ConfirmWriteDeps = {},
): Promise<ConfirmWriteResult> {
  const actorId = actor?.id?.trim();
  if (!actorId) {
    return { ok: false, status: 400, message: CONFIRM_ERROR_MESSAGES.INVALID_REQUEST };
  }

  const verified = await verifySignedIntent(token, { secret: deps.secret, now: deps.now });
  if (!verified.ok) {
    if (verified.code === "EXPIRED") {
      return { ok: false, status: 410, message: CONFIRM_ERROR_MESSAGES.EXPIRED };
    }
    return { ok: false, status: 400, message: CONFIRM_ERROR_MESSAGES.INVALID_REQUEST };
  }

  if (
    isCriticalToolName(verified.intent.toolName) ||
    !isConfirmableWriteToolName(verified.intent.toolName)
  ) {
    return { ok: false, status: 403, message: CONFIRM_ERROR_MESSAGES.FORBIDDEN };
  }

  const bound = bindIntentToActor(verified.intent, actorId, deps.secret);
  if (!bound) {
    return { ok: false, status: 403, message: CONFIRM_ERROR_MESSAGES.FORBIDDEN };
  }

  const execute = deps.execute ?? executeConfirmedWrite;
  let result: ToolResult;
  try {
    result = await execute(
      toConfirmedWriteInput({
        actor,
        actionId: bound.actionId,
        expiresAt: bound.expiresAt,
        toolName: bound.toolName,
        args: bound.args,
      }),
    );
  } catch (error) {
    if (isReplayError(error)) {
      return { ok: false, status: 409, message: CONFIRM_ERROR_MESSAGES.CONSUMED };
    }
    return { ok: false, status: 500, message: CONFIRM_ERROR_MESSAGES.UNAVAILABLE };
  }

  if (!result.success) {
    return httpFailureFromToolResult(result);
  }

  return {
    ok: true,
    actionId: bound.actionId,
    toolName: bound.toolName,
    data: result.data,
  };
}

export type ConfirmHttpResult = {
  status: 200 | 400 | 401 | 403 | 409 | 410 | 500;
  body: Record<string, unknown>;
};

export async function handleConfirmActionRequest(input: {
  actor: SessionUser;
  body: unknown;
} & ConfirmWriteDeps): Promise<ConfirmHttpResult> {
  const parsed = confirmActionBodySchema.safeParse(input.body);
  if (!parsed.success) {
    return { status: 400, body: { error: CONFIRM_ERROR_MESSAGES.INVALID_REQUEST } };
  }

  const token = extractConfirmToken(parsed.data);
  if (!token) {
    return { status: 400, body: { error: CONFIRM_ERROR_MESSAGES.INVALID_REQUEST } };
  }

  const result = await confirmWriteAction(input.actor, token, input);
  if (!result.ok) {
    return { status: result.status, body: { error: result.message } };
  }

  return {
    status: 200,
    body: {
      ok: true,
      actionId: result.actionId,
      toolName: result.toolName,
      data: result.data,
    },
  };
}

function wrapLooseExecutor(execute: (...args: unknown[]) => unknown): ExecuteConfirmedWrite {
  return async (input) => {
    const raw = await execute(input);
    if (raw && typeof raw === "object" && "success" in raw) {
      return raw as ToolResult;
    }
    if (raw && typeof raw === "object") {
      return toolSuccess(raw);
    }
    return toolSuccess({ ok: true });
  };
}

/**
 * Object-form consume used by tests and Agent C/D.
 * Same checks as `confirmWriteAction`; `{ confirmed: true }` is not accepted.
 */
export async function consumeWriteProposal(input: {
  token: string;
  actor: SessionUser;
  execute?: (...args: unknown[]) => unknown;
  now?: Date;
  secret?: string;
}): Promise<ConfirmWriteResult> {
  const execute = input.execute ? wrapLooseExecutor(input.execute) : undefined;
  return confirmWriteAction(input.actor, input.token, {
    execute,
    now: input.now,
    secret: input.secret,
  });
}

export { createWriteProposal };
