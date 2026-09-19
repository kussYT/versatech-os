/**
 * Wave 6 — durable single-use confirmation (concurrency / rollback / restart).
 *
 * UNIQUE `actionId` is the authority (P2002 → ALREADY_CONSUMED). Claim is INSERT
 * in a transaction (`claimAiActionConsumption` + `runConfirmedWrite`). Confirm
 * body remains `{ token }` only. In-memory process Set/Map is not the authority.
 *
 * Isolated fake tx — no live PostgreSQL, no ALEX'CEPTION writes.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import {
  CONFIRM_ERROR_MESSAGES,
  confirmActionBodySchema,
  confirmWriteAction,
  createWriteProposal,
  extractConfirmToken,
  handleConfirmActionRequest,
  type ConfirmedWriteInput,
  type ExecuteConfirmedWrite,
} from "@/ai/confirmation";
import { toolFailure, toolSuccess } from "@/ai/result";
import { executeTool, productionToolCatalog } from "@/ai/tools/registry";
import { createToolRuntime } from "@/ai/context";
import {
  CONFIRMATION_ALREADY_MESSAGE,
  buildConfirmRequestBody,
  confirmRequestBodyKeys,
  confirmationResultFromResponse,
  createDoubleSubmitGuard,
} from "@/components/ai/confirmation";
import type { SessionUser } from "@/lib/auth/types";
import {
  ALREADY_CONSUMED,
  AlreadyConsumedError,
  claimAiActionConsumption,
  runConfirmedWrite,
} from "@/lib/services/ai-action-consumption";
import type {
  RunConfirmedWriteDeps,
  RunConfirmedWriteTransaction,
} from "@/lib/services/ai-action-consumption/run-confirmed-write";
import { serviceOk } from "@/lib/services/_shared/result";

if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
  process.env.AUTH_SECRET = "unit-test-secret-at-least-32-characters-long";
}

const SECRET = "unit-test-secret-at-least-32-characters-long";
const NOW = new Date("2026-09-19T10:00:00.000Z");
const DUE_AT = "2026-09-20T08:00:00.000Z";
const REPO_ROOT = path.resolve(process.cwd());
const FOLLOW_UP_ARGS = {
  companyId: "co_1",
  dueAt: DUE_AT,
  title: "Relance",
};

const SESSION_ACTOR: SessionUser = {
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

type UniqueRow = { actionId: string; actorId: string; toolName: string };

function p2002(): Error & { code: "P2002" } {
  return Object.assign(new Error("Unique constraint failed on the fields: (`actionId`)"), {
    code: "P2002" as const,
  });
}

/**
 * Fake Postgres: UNIQUE insert is visible to concurrent txs immediately.
 * Métier + ActivityLog commit only if the callback returns. A throw rolls back
 * this tx's consumption row only — a losing P2002 must not wipe the winner.
 */
function createDurableHarness() {
  const unique = new Map<string, UniqueRow>();
  const mutations: unknown[] = [];
  const activityLog: unknown[] = [];
  let attempts = 0;
  let throwOnAttempt: number | undefined;

  const frames = new WeakMap<
    object,
    { inserted: string[]; mutation?: unknown; log?: unknown }
  >();

  const transaction: RunConfirmedWriteTransaction = async (fn) => {
    const frame: { inserted: string[]; mutation?: unknown; log?: unknown } = {
      inserted: [],
    };
    const tx = {
      aiActionConsumption: {
        create: async ({ data }: { data: UniqueRow & { consumedAt: Date; expiresAt: Date } }) => {
          await Promise.resolve();
          if (unique.has(data.actionId)) {
            throw p2002();
          }
          unique.set(data.actionId, {
            actionId: data.actionId,
            actorId: data.actorId,
            toolName: data.toolName,
          });
          frame.inserted.push(data.actionId);
          return data;
        },
      },
    };
    frames.set(tx, frame);
    try {
      const result = await fn(tx);
      if (frame.mutation) {
        mutations.push(frame.mutation);
      }
      if (frame.log) {
        activityLog.push(frame.log);
      }
      return result;
    } catch (error) {
      for (const actionId of frame.inserted) {
        unique.delete(actionId);
      }
      throw error;
    }
  };

  const createFollowUp: NonNullable<RunConfirmedWriteDeps["createFollowUp"]> = async (
    input,
    deps,
  ) => {
    attempts += 1;
    if (throwOnAttempt === attempts) {
      throw new Error("transient métier failure");
    }
    const frame = deps?.tx ? frames.get(deps.tx) : undefined;
    const row = { companyId: input.companyId, title: input.title, actorId: input.actor.id };
    const log = { action: "FOLLOW_UP_CREATED", actionId: input.companyId };
    if (frame) {
      frame.mutation = row;
      frame.log = log;
    }
    return serviceOk({ followUpId: "fu_1", companyId: input.companyId });
  };

  const deps: RunConfirmedWriteDeps = {
    transaction,
    claim: claimAiActionConsumption,
    purge: async () => ({ count: 0 }),
    now: NOW,
    createFollowUp,
    completeFollowUp: async () => serviceOk({ followUpId: "fu_1", companyId: "co_1" }),
    createTask: async () => serviceOk({ taskId: "task_1", companyId: "co_1" }),
  };

  const execute: ExecuteConfirmedWrite = async (input) => {
    const result = await runConfirmedWrite(input, deps);
    if (!result.ok && result.code === ALREADY_CONSUMED) {
      throw new AlreadyConsumedError(input.actionId);
    }
    if (!result.ok) {
      return toolFailure("INTERNAL", result.message);
    }
    return toolSuccess(result.data);
  };

  return {
    unique,
    mutations,
    activityLog,
    get attempts() {
      return attempts;
    },
    setThrowOnAttempt(value: number | undefined) {
      throwOnAttempt = value;
    },
    execute,
  };
}

async function proposeFollowUp() {
  return createWriteProposal(
    {
      actor: SESSION_ACTOR,
      toolName: "createFollowUp",
      args: FOLLOW_UP_ARGS,
    },
    { secret: SECRET, now: NOW },
  );
}

function confirmDeps(execute: ExecuteConfirmedWrite, now: Date = NOW) {
  return { secret: SECRET, now, execute };
}

describe("A. normal confirm → métier executor exactly once", () => {
  test("signed { token } confirm commits métier + ActivityLog once", async () => {
    const proposal = await proposeFollowUp();
    assert.equal(proposal.ok, true);
    if (!proposal.ok) {
      return;
    }
    const harness = createDurableHarness();
    const result = await handleConfirmActionRequest({
      actor: SESSION_ACTOR,
      body: { token: proposal.token },
      ...confirmDeps(harness.execute),
    });
    assert.equal(result.status, 200);
    assert.equal(harness.attempts, 1);
    assert.equal(harness.mutations.length, 1);
    assert.equal(harness.activityLog.length, 1);
    assert.equal(harness.unique.size, 1);
    assert.equal(harness.unique.get(proposal.view.actionId)?.actorId, SESSION_ACTOR.id);
    assert.equal(result.body.actionId, proposal.view.actionId);
    assert.equal(result.body.toolName, "createFollowUp");
  });
});

describe("B. sequential same token → second replay 409", () => {
  test("second confirm is ALREADY_CONSUMED and métier does not run again", async () => {
    const proposal = await proposeFollowUp();
    assert.equal(proposal.ok, true);
    if (!proposal.ok) {
      return;
    }
    const harness = createDurableHarness();
    const first = await confirmWriteAction(SESSION_ACTOR, proposal.token, confirmDeps(harness.execute));
    const second = await confirmWriteAction(SESSION_ACTOR, proposal.token, confirmDeps(harness.execute));
    assert.equal(first.ok, true);
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.equal(second.status, 409);
      assert.equal(second.message, CONFIRM_ERROR_MESSAGES.CONSUMED);
    }
    assert.equal(harness.mutations.length, 1);
    assert.equal(harness.attempts, 1);
  });
});

describe("C. Promise.all two confirms same token → 1 success + 1 replay, métier once", () => {
  test("concurrent confirm is serialized by UNIQUE insert, not by an in-memory Set", async () => {
    const proposal = await proposeFollowUp();
    assert.equal(proposal.ok, true);
    if (!proposal.ok) {
      return;
    }
    const harness = createDurableHarness();
    const outcomes = await Promise.all([
      confirmWriteAction(SESSION_ACTOR, proposal.token, confirmDeps(harness.execute)),
      confirmWriteAction(SESSION_ACTOR, proposal.token, confirmDeps(harness.execute)),
    ]);
    assert.equal(outcomes.filter((row) => row.ok).length, 1);
    const replay = outcomes.find((row) => !row.ok);
    assert.ok(replay);
    if (!replay.ok) {
      assert.equal(replay.status, 409);
    }
    assert.equal(harness.mutations.length, 1);
    assert.equal(harness.unique.size, 1);
  });
});

describe("D. empty in-memory / simulated restart → still blocked", () => {
  test("clearing a process Set does not revive a UNIQUE-consumed actionId", async () => {
    const proposal = await proposeFollowUp();
    assert.equal(proposal.ok, true);
    if (!proposal.ok) {
      return;
    }
    const harness = createDurableHarness();
    const first = await confirmWriteAction(SESSION_ACTOR, proposal.token, confirmDeps(harness.execute));
    assert.equal(first.ok, true);

    const processMemory = new Set<string>();
    assert.equal(processMemory.size, 0, "simulated Node restart: in-memory store is empty");
    assert.equal(harness.unique.has(proposal.view.actionId), true);

    const replay = await confirmWriteAction(SESSION_ACTOR, proposal.token, confirmDeps(harness.execute));
    assert.equal(replay.ok, false);
    if (!replay.ok) {
      assert.equal(replay.status, 409);
    }
    assert.equal(harness.mutations.length, 1);
  });
});

describe("E. other actor → 403, attacker does not consume", () => {
  test("bind fails before INSERT; owner can still confirm once", async () => {
    const proposal = await proposeFollowUp();
    assert.equal(proposal.ok, true);
    if (!proposal.ok) {
      return;
    }
    const harness = createDurableHarness();
    const attack = await confirmWriteAction(OTHER_ACTOR, proposal.token, confirmDeps(harness.execute));
    assert.equal(attack.ok, false);
    if (!attack.ok) {
      assert.equal(attack.status, 403);
    }
    assert.equal(harness.unique.size, 0);
    assert.equal(harness.mutations.length, 0);
    assert.equal(harness.attempts, 0);

    const owner = await confirmWriteAction(SESSION_ACTOR, proposal.token, confirmDeps(harness.execute));
    assert.equal(owner.ok, true);
    assert.equal(harness.unique.get(proposal.view.actionId)?.actorId, SESSION_ACTOR.id);
    assert.notEqual(harness.unique.get(proposal.view.actionId)?.actorId, OTHER_ACTOR.id);
    assert.equal(harness.mutations.length, 1);
  });
});

describe("F. tampered token → refuse, no claim", () => {
  test("payload rewrite is INVALID and UNIQUE table stays empty", async () => {
    const proposal = await proposeFollowUp();
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

    const harness = createDurableHarness();
    const result = await confirmWriteAction(SESSION_ACTOR, tampered, confirmDeps(harness.execute));
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 400);
    }
    assert.equal(harness.unique.size, 0);
    assert.equal(harness.mutations.length, 0);
    assert.equal(harness.attempts, 0);
  });
});

describe("G. expired → 410, no mutation", () => {
  test("TTL expiry does not INSERT a consumption row", async () => {
    const proposal = await proposeFollowUp();
    assert.equal(proposal.ok, true);
    if (!proposal.ok) {
      return;
    }
    const harness = createDurableHarness();
    const expiredAt = new Date(NOW.getTime() + 6 * 60 * 1000);
    const result = await confirmWriteAction(
      SESSION_ACTOR,
      proposal.token,
      confirmDeps(harness.execute, expiredAt),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 410);
    }
    assert.equal(harness.unique.size, 0);
    assert.equal(harness.mutations.length, 0);
    assert.equal(harness.attempts, 0);
  });
});

describe("H. Business Service throw inside tx → mutation, ActivityLog, consumption rolled back", () => {
  test("fake tx restores UNIQUE row, métier, and journal", async () => {
    const proposal = await proposeFollowUp();
    assert.equal(proposal.ok, true);
    if (!proposal.ok) {
      return;
    }
    const harness = createDurableHarness();
    harness.setThrowOnAttempt(1);
    const result = await confirmWriteAction(SESSION_ACTOR, proposal.token, confirmDeps(harness.execute));
    assert.equal(result.ok, false);
    assert.equal(harness.attempts, 1);
    assert.equal(harness.mutations.length, 0);
    assert.equal(harness.activityLog.length, 0);
    assert.equal(harness.unique.size, 0);
    assert.equal(harness.unique.get(proposal.view.actionId), undefined);
  });
});

describe("I. retry after transient failure while token valid → can succeed once", () => {
  test("rolled-back claim leaves the token usable for a single later success", async () => {
    const proposal = await proposeFollowUp();
    assert.equal(proposal.ok, true);
    if (!proposal.ok) {
      return;
    }
    const harness = createDurableHarness();
    harness.setThrowOnAttempt(1);
    const first = await confirmWriteAction(SESSION_ACTOR, proposal.token, confirmDeps(harness.execute));
    assert.equal(first.ok, false);
    assert.equal(harness.unique.size, 0);

    harness.setThrowOnAttempt(undefined);
    const second = await confirmWriteAction(SESSION_ACTOR, proposal.token, confirmDeps(harness.execute));
    assert.equal(second.ok, true);
    assert.equal(harness.mutations.length, 1);
    assert.equal(harness.unique.size, 1);

    const third = await confirmWriteAction(SESSION_ACTOR, proposal.token, confirmDeps(harness.execute));
    assert.equal(third.ok, false);
    if (!third.ok) {
      assert.equal(third.status, 409);
    }
    assert.equal(harness.mutations.length, 1);
  });
});

describe("J. double-click UI guard + backend UNIQUE", () => {
  test("frontend guard still coalesces clicks and UNIQUE still holds if both fire", async () => {
    const guard = createDoubleSubmitGuard();
    let runs = 0;
    let release: () => void = () => {};
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = guard.run(async () => {
      runs += 1;
      await pending;
      return "ok";
    });
    const second = guard.run(async () => {
      runs += 1;
      return "nope";
    });
    release();
    assert.equal(await first, "ok");
    assert.equal(await second, undefined);
    assert.equal(runs, 1);

    const uiSource = readFileSync(
      path.join(REPO_ROOT, "src", "components", "ai", "confirmation.ts"),
      "utf8",
    );
    assert.match(uiSource, /export function createDoubleSubmitGuard/);
    assert.match(uiSource, /code === "ALREADY_CONSUMED"/);

    const proposal = await proposeFollowUp();
    assert.equal(proposal.ok, true);
    if (!proposal.ok) {
      return;
    }
    const harness = createDurableHarness();
    const raced = await Promise.all([
      confirmWriteAction(SESSION_ACTOR, proposal.token, confirmDeps(harness.execute)),
      confirmWriteAction(SESSION_ACTOR, proposal.token, confirmDeps(harness.execute)),
    ]);
    assert.equal(raced.filter((row) => row.ok).length, 1);
    assert.equal(harness.mutations.length, 1);

    const mapped = await confirmationResultFromResponse(
      new Response(JSON.stringify({ error: { code: ALREADY_CONSUMED } }), { status: 409 }),
    );
    assert.equal(mapped.ok, false);
    if (!mapped.ok) {
      assert.equal(mapped.reason, "consumed");
      assert.equal(mapped.message, CONFIRMATION_ALREADY_MESSAGE);
    }
  });
});

describe("confirm body is { token } only", () => {
  test("schema and client POST keep token as the only authority", async () => {
    const proposal = await proposeFollowUp();
    assert.equal(proposal.ok, true);
    if (!proposal.ok) {
      return;
    }

    assert.deepEqual(confirmRequestBodyKeys({ token: proposal.token }), ["token"]);
    const clientBody = JSON.parse(buildConfirmRequestBody({ token: proposal.token })) as Record<
      string,
      unknown
    >;
    assert.deepEqual(Object.keys(clientBody), ["token"]);

    const parsed = confirmActionBodySchema.safeParse({
      token: proposal.token,
      actionId: "act_forged",
      toolName: "createPayment",
      args: { companyId: "co_hacked" },
      actorId: OTHER_ACTOR.id,
      confirmed: true,
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(extractConfirmToken(parsed.data), proposal.token);
      assert.equal("actionId" in parsed.data, false);
      assert.equal("args" in parsed.data, false);
    }

    const harness = createDurableHarness();
    const result = await handleConfirmActionRequest({
      actor: SESSION_ACTOR,
      body: {
        token: proposal.token,
        actionId: "act_forged",
        toolName: "createPayment",
        args: { companyId: "co_hacked" },
        confirmed: true,
      },
      ...confirmDeps(harness.execute),
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.actionId, proposal.view.actionId);
    assert.notEqual(result.body.actionId, "act_forged");
    assert.equal(harness.unique.get(proposal.view.actionId)?.actorId, SESSION_ACTOR.id);
  });

  test("handleConfirmActionRequest still ignores extra body keys (Wave 5 HTTP surface)", async () => {
    const proposal = await proposeFollowUp();
    assert.equal(proposal.ok, true);
    if (!proposal.ok) {
      return;
    }
    const calls: ConfirmedWriteInput[] = [];
    const http = await handleConfirmActionRequest({
      actor: SESSION_ACTOR,
      body: { token: proposal.token, toolName: "createPayment", args: { companyId: "co_hacked" } },
      secret: SECRET,
      now: NOW,
      execute: async (input) => {
        calls.push(input);
        return toolSuccess({ followUpId: "fu_http" });
      },
    });
    assert.equal(http.status, 200);
    assert.deepEqual(calls[0]?.args, FOLLOW_UP_ARGS);
  });
});

describe("in-memory store is not the authority", () => {
  test("process Set/Map must not remain source of truth now that claimAiActionConsumption is wired", () => {
    const consumedPath = path.join(REPO_ROOT, "src", "ai", "confirmation", "consumed.ts");
    const confirmSource = readFileSync(
      path.join(REPO_ROOT, "src", "ai", "confirmation", "confirm.ts"),
      "utf8",
    );
    const executeSource = readFileSync(
      path.join(REPO_ROOT, "src", "ai", "confirmation", "execute.ts"),
      "utf8",
    );
    const runSource = readFileSync(
      path.join(REPO_ROOT, "src", "lib", "services", "ai-action-consumption", "run-confirmed-write.ts"),
      "utf8",
    );

    assert.match(confirmSource, /claimAiActionConsumption/);
    assert.match(runSource, /claimAiActionConsumption/);
    assert.match(executeSource, /runConfirmedWrite/);
    assert.doesNotMatch(confirmSource, /getProcessConsumedActionStore/);
    assert.doesNotMatch(confirmSource, /ConsumedActionStore/);
    assert.doesNotMatch(executeSource, /new Set\s*</);
    assert.equal(existsSync(consumedPath), false, "consumed.ts process store must not remain");
  });
});

describe("non-regression: Jarvis WRITE / CRITICAL catalog", () => {
  function runtime() {
    const created = createToolRuntime(SESSION_ACTOR, "req_durable_nr");
    assert.equal(created.ok, true);
    if (!created.ok) {
      throw new Error("expected authenticated runtime");
    }
    return created.runtime;
  }

  test("createFollowUp / completeFollowUp / createTask stay CONFIRMATION_REQUIRED from executeTool", async () => {
    const rt = runtime();
    const followUp = await executeTool({
      runtime: rt,
      name: "createFollowUp",
      input: FOLLOW_UP_ARGS,
    });
    assert.equal(followUp.success, false);
    if (!followUp.success) {
      assert.equal(followUp.error.code, "CONFIRMATION_REQUIRED");
    }

    const complete = await executeTool({
      runtime: rt,
      name: "completeFollowUp",
      input: { followUpId: "fu_1" },
    });
    assert.equal(complete.success, false);
    if (!complete.success) {
      assert.equal(complete.error.code, "CONFIRMATION_REQUIRED");
    }

    const task = await executeTool({
      runtime: rt,
      name: "createTask",
      input: { title: "Rappeler Jacques", companyId: "co_1" },
    });
    assert.equal(task.success, false);
    if (!task.success) {
      assert.equal(task.error.code, "CONFIRMATION_REQUIRED");
    }
  });

  test("updateTaskStatus is not a Jarvis tool; CRITICAL stays FORBIDDEN", async () => {
    assert.equal(
      productionToolCatalog.some((entry) => entry.name === "updateTaskStatus"),
      false,
    );
    const rt = runtime();
    const status = await executeTool({
      runtime: rt,
      name: "updateTaskStatus",
      input: { taskId: "task_1", status: "DONE" },
    });
    assert.equal(status.success, false);
    if (!status.success) {
      assert.equal(status.error.code, "FORBIDDEN");
    }

    const critical = await executeTool({
      runtime: rt,
      name: "updateQuoteStatus",
      input: { quoteId: "qu_alexception", status: "ACCEPTED", confirmed: true },
    });
    assert.equal(critical.success, false);
    if (!critical.success) {
      assert.equal(critical.error.code, "FORBIDDEN");
    }
  });
});
