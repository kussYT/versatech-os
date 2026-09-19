import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { decodeJwt } from "jose";
import {
  ACTION_INTENT_TTL_SECONDS,
  CONFIRM_ERROR_MESSAGES,
  confirmWriteAction,
  createWriteProposal,
  handleConfirmActionRequest,
  type ConfirmedWriteInput,
  type ExecuteConfirmedWrite,
} from "@/ai/confirmation";
import { AlreadyConsumedError } from "@/lib/services/ai-action-consumption/errors";
import { createSessionToken } from "@/lib/auth/token";
import { toolSuccess, type ToolResult } from "@/ai/result";
import type { SessionUser } from "@/lib/auth/types";

const SECRET = "unit-test-secret-at-least-32-characters-long";
const OTHER_SECRET = "another-secret-at-least-32-characters!!";

const ACTOR: SessionUser = {
  id: "user_session",
  name: "Camille Durand",
  email: "camille.durand@versatech.example",
  role: "ADMIN",
};

const OTHER_ACTOR: SessionUser = {
  id: "user_other",
  name: "Autre Opérateur",
  email: "autre@versatech.example",
  role: "ADMIN",
};

const FOLLOW_UP_ARGS = {
  companyId: "co_alexception",
  dueAt: "2026-09-20T08:00:00.000Z",
  title: "Relance Jacques",
};

const NOW = new Date("2026-09-19T10:00:00.000Z");

function recordingExecutor(calls: ConfirmedWriteInput[]): ExecuteConfirmedWrite {
  return async (input) => {
    calls.push(input);
    return toolSuccess({ followUpId: "fu_created" });
  };
}

function singleUseExecutor(calls: ConfirmedWriteInput[]): ExecuteConfirmedWrite {
  const seen = new Set<string>();
  return async (input) => {
    if (seen.has(input.actionId)) {
      throw new AlreadyConsumedError(input.actionId);
    }
    seen.add(input.actionId);
    calls.push(input);
    return toolSuccess({ followUpId: "fu_created" });
  };
}

async function propose(overrides?: {
  actor?: SessionUser;
  toolName?: string;
  args?: unknown;
  now?: Date;
  secret?: string;
  actionId?: string;
}) {
  return createWriteProposal(
    {
      actor: overrides?.actor ?? ACTOR,
      toolName: overrides?.toolName ?? "createFollowUp",
      args: overrides?.args ?? FOLLOW_UP_ARGS,
    },
    {
      secret: overrides?.secret ?? SECRET,
      now: overrides?.now ?? NOW,
      actionId: overrides?.actionId,
    },
  );
}

describe("createWriteProposal", () => {
  test("TTL is inside the 5–10 minute window", () => {
    assert.ok(ACTION_INTENT_TTL_SECONDS >= 5 * 60);
    assert.ok(ACTION_INTENT_TTL_SECONDS <= 10 * 60);
  });

  test("signs an opaque token and a view without actorId or secrets", async () => {
    const result = await propose();
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }

    assert.equal(result.view.toolName, "createFollowUp");
    assert.equal(result.view.actionId.length > 0, true);
    assert.equal(result.view.expiresAt, new Date(NOW.getTime() + ACTION_INTENT_TTL_SECONDS * 1000).toISOString());
    assert.match(result.view.humanSummary, /relance/i);
    assert.equal("actorId" in result.view, false);
    assert.equal("args" in result.view, false);
    assert.equal(JSON.stringify(result.view).includes(ACTOR.id), false);
    assert.equal(JSON.stringify(result.view).includes(SECRET), false);
    assert.equal(result.token.includes(SECRET), false);

    const payload = decodeJwt(result.token);
    assert.equal("actorId" in payload, false);
    assert.equal("sub" in payload, false);
    assert.equal(payload.toolName, "createFollowUp");
    assert.deepEqual(payload.args, FOLLOW_UP_ARGS);
    assert.equal(JSON.stringify(payload).includes(ACTOR.id), false);
    assert.equal(JSON.stringify(payload).includes("AUTH_SECRET"), false);
  });

  test("refuses CRITICAL, READ, and WRITE names outside the allowlist", async () => {
    for (const toolName of [
      "createPayment",
      "updateQuoteStatus",
      "updateOpportunityStageWonLost",
      "createCompany",
      "getTodayOverview",
      "runPrisma",
    ]) {
      const result = await propose({ toolName, args: {} });
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.code, "FORBIDDEN");
      }
    }
  });

  test("refuses invalid args at proposal time", async () => {
    const result = await propose({ args: { companyId: "co_x" } });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "VALIDATION_FAILED");
    }
  });

  test("strips model confirmation flags from signed args", async () => {
    const result = await propose({
      args: {
        ...FOLLOW_UP_ARGS,
        confirmed: true,
        actorId: "user_from_model",
        confirmation: { token: "from-model" },
      },
    });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    const payload = decodeJwt(result.token);
    assert.deepEqual(payload.args, FOLLOW_UP_ARGS);
    assert.equal(JSON.stringify(payload.args).includes("confirmed"), false);
    assert.equal(JSON.stringify(payload.args).includes("user_from_model"), false);
  });
});

describe("confirmWriteAction protocol", () => {
  test("confirms with the signed args via an injected executor, ignoring client execute fields", async () => {
    const proposal = await propose();
    assert.equal(proposal.ok, true);
    if (!proposal.ok) {
      return;
    }

    const calls: ConfirmedWriteInput[] = [];
    const http = await handleConfirmActionRequest({
      actor: ACTOR,
      body: {
        token: proposal.token,
        toolName: "createPayment",
        args: { quoteId: "q_should_not_run", confirmed: true },
        confirmed: true,
      },
      secret: SECRET,
      now: NOW,
      execute: recordingExecutor(calls),
    });

    assert.equal(http.status, 200);
    assert.equal(http.body.ok, true);
    assert.equal(http.body.actionId, proposal.view.actionId);
    assert.equal(http.body.toolName, "createFollowUp");
    assert.deepEqual(http.body.data, { followUpId: "fu_created" });
    assert.equal("actorId" in http.body, false);
    assert.equal(JSON.stringify(http.body).includes(SECRET), false);

    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.toolName, "createFollowUp");
    assert.equal(calls[0]?.actor.id, ACTOR.id);
    assert.deepEqual(calls[0]?.args, FOLLOW_UP_ARGS);
    assert.equal(calls[0]?.actionId, proposal.view.actionId);
  });

  test("rejects { confirmation } wrapper; completeFollowUp confirms via { token }", async () => {
    const proposal = await propose({
      toolName: "completeFollowUp",
      args: { followUpId: "fu_pending_1" },
    });
    assert.equal(proposal.ok, true);
    if (!proposal.ok) {
      return;
    }

    const calls: ConfirmedWriteInput[] = [];
    const wrapper = await handleConfirmActionRequest({
      actor: ACTOR,
      body: { confirmation: proposal.token },
      secret: SECRET,
      now: NOW,
      execute: recordingExecutor(calls),
    });
    assert.equal(wrapper.status, 400);
    assert.equal(calls.length, 0);

    const http = await handleConfirmActionRequest({
      actor: ACTOR,
      body: { token: proposal.token },
      secret: SECRET,
      now: NOW,
      execute: recordingExecutor(calls),
    });
    assert.equal(http.status, 200);
    assert.equal(calls[0]?.toolName, "completeFollowUp");
    assert.deepEqual(calls[0]?.args, { followUpId: "fu_pending_1" });
  });

  test("{ confirmed: true } from the model is not proof and does not execute", async () => {
    const calls: ConfirmedWriteInput[] = [];
    const http = await handleConfirmActionRequest({
      actor: ACTOR,
      body: { confirmed: true, toolName: "createFollowUp", args: FOLLOW_UP_ARGS },
      secret: SECRET,
      now: NOW,
      execute: recordingExecutor(calls),
    });
    assert.equal(http.status, 400);
    assert.deepEqual(http.body, { error: CONFIRM_ERROR_MESSAGES.INVALID_REQUEST });
    assert.equal(calls.length, 0);
  });

  test("rejects a tampered payload (integrity)", async () => {
    const proposal = await propose();
    assert.equal(proposal.ok, true);
    if (!proposal.ok) {
      return;
    }

    const [header, payload, signature] = proposal.token.split(".");
    const claims = JSON.parse(Buffer.from(payload ?? "", "base64url").toString("utf8")) as {
      args: Record<string, unknown>;
    };
    claims.args = { ...FOLLOW_UP_ARGS, companyId: "co_tampered" };
    const tampered = `${header}.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.${signature}`;

    const calls: ConfirmedWriteInput[] = [];
    const result = await confirmWriteAction(ACTOR, tampered, {
      secret: SECRET,
      now: NOW,
      execute: recordingExecutor(calls),
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 400);
      assert.equal(result.message.includes("at "), false);
    }
    assert.equal(calls.length, 0);
  });

  test("rejects a token signed with another secret", async () => {
    const proposal = await propose({ secret: OTHER_SECRET });
    assert.equal(proposal.ok, true);
    if (!proposal.ok) {
      return;
    }
    const calls: ConfirmedWriteInput[] = [];
    const result = await confirmWriteAction(ACTOR, proposal.token, {
      secret: SECRET,
      now: NOW,
      execute: recordingExecutor(calls),
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 400);
    }
    assert.equal(calls.length, 0);
  });

  test("rejects a session JWT used as a confirmation token", async () => {
    const sessionToken = await createSessionToken(ACTOR.id, 0, SECRET, 300);
    const calls: ConfirmedWriteInput[] = [];
    const result = await confirmWriteAction(ACTOR, sessionToken, {
      secret: SECRET,
      now: NOW,
      execute: recordingExecutor(calls),
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 400);
    }
    assert.equal(calls.length, 0);
  });

  test("expires after TTL (410)", async () => {
    const proposal = await propose();
    assert.equal(proposal.ok, true);
    if (!proposal.ok) {
      return;
    }
    const calls: ConfirmedWriteInput[] = [];
    const expiredAt = new Date(NOW.getTime() + (ACTION_INTENT_TTL_SECONDS + 30) * 1000);
    const result = await confirmWriteAction(ACTOR, proposal.token, {
      secret: SECRET,
      now: expiredAt,
      execute: recordingExecutor(calls),
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 410);
      assert.equal(result.message, CONFIRM_ERROR_MESSAGES.EXPIRED);
    }
    assert.equal(calls.length, 0);
  });

  test("still valid shortly before expiry", async () => {
    const proposal = await propose();
    assert.equal(proposal.ok, true);
    if (!proposal.ok) {
      return;
    }
    const calls: ConfirmedWriteInput[] = [];
    const almostExpired = new Date(NOW.getTime() + (ACTION_INTENT_TTL_SECONDS - 30) * 1000);
    const result = await confirmWriteAction(ACTOR, proposal.token, {
      secret: SECRET,
      now: almostExpired,
      execute: recordingExecutor(calls),
    });
    assert.equal(result.ok, true);
    assert.equal(calls.length, 1);
  });

  test("is single-use (409 on replay)", async () => {
    const proposal = await propose();
    assert.equal(proposal.ok, true);
    if (!proposal.ok) {
      return;
    }
    const calls: ConfirmedWriteInput[] = [];
    const execute = singleUseExecutor(calls);
    const first = await confirmWriteAction(ACTOR, proposal.token, {
      secret: SECRET,
      now: NOW,
      execute,
    });
    const second = await confirmWriteAction(ACTOR, proposal.token, {
      secret: SECRET,
      now: NOW,
      execute,
    });
    assert.equal(first.ok, true);
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.equal(second.status, 409);
      assert.equal(second.message, CONFIRM_ERROR_MESSAGES.CONSUMED);
    }
    assert.equal(calls.length, 1);
  });

  test("binds the token to the session actor (403 for another user)", async () => {
    const proposal = await propose();
    assert.equal(proposal.ok, true);
    if (!proposal.ok) {
      return;
    }
    const calls: ConfirmedWriteInput[] = [];
    const result = await confirmWriteAction(OTHER_ACTOR, proposal.token, {
      secret: SECRET,
      now: NOW,
      execute: recordingExecutor(calls),
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 403);
      assert.equal(result.message, CONFIRM_ERROR_MESSAGES.FORBIDDEN);
    }
    assert.equal(calls.length, 0);
  });

  test("createTask is confirmable and the stub executor is independent of protocol tests", async () => {
    const proposal = await propose({
      toolName: "createTask",
      args: { title: "Rappeler Jacques", companyId: "co_alexception", priority: "HIGH" },
    });
    assert.equal(proposal.ok, true);
    if (!proposal.ok) {
      return;
    }

    const calls: ConfirmedWriteInput[] = [];
    const execute: ExecuteConfirmedWrite = async (input) => {
      calls.push(input);
      return toolSuccess({ taskId: "task_1" }) as ToolResult;
    };
    const result = await confirmWriteAction(ACTOR, proposal.token, {
      secret: SECRET,
      now: NOW,
      execute,
    });
    assert.equal(result.ok, true);
    assert.equal(calls[0]?.toolName, "createTask");
    assert.deepEqual(calls[0]?.args, {
      title: "Rappeler Jacques",
      companyId: "co_alexception",
      priority: "HIGH",
    });
  });
});
