import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { SessionUser } from "@/lib/auth/types";
import { serviceFail, serviceOk } from "@/lib/services/_shared/result";
import { claimAiActionConsumption } from "./claim";
import { ALREADY_CONSUMED } from "./errors";
import {
  runConfirmedWrite,
  type ConfirmedWriteTx,
  type RunConfirmedWriteInput,
} from "./run-confirmed-write";

const actor: SessionUser = {
  id: "user_session",
  name: "Camille Durand",
  email: "camille.durand@versatech.example",
  role: "ADMIN",
};

const expiresAt = "2026-09-19T10:05:00.000Z";

const createFollowUpInput: RunConfirmedWriteInput = {
  actor,
  actionId: "act_1",
  expiresAt,
  toolName: "createFollowUp",
  args: {
    companyId: "co_atelier",
    dueAt: "2026-09-21T08:00:00.000Z",
    title: "Relance Jacques",
  },
};

function createFakeEngine() {
  const rows = new Map<string, Record<string, unknown>>();
  const mutations: Array<Record<string, unknown>> = [];
  let lock = Promise.resolve();

  const transaction = async <T>(fn: (tx: ConfirmedWriteTx) => Promise<T>): Promise<T> => {
    const previous = lock;
    let release: () => void = () => undefined;
    lock = new Promise((resolve) => {
      release = resolve;
    });
    await previous;
    const snapshot = new Map(rows);
    const mutSnapshot = mutations.map((row) => ({ ...row }));
    try {
      const tx = {
        aiActionConsumption: {
          create: async ({ data }: { data: Record<string, unknown> & { actionId: string } }) => {
            if (rows.has(data.actionId)) {
              throw { code: "P2002" };
            }
            rows.set(data.actionId, data);
            return data;
          },
        },
      };
      return await fn(tx as ConfirmedWriteTx);
    } catch (error) {
      rows.clear();
      for (const [key, value] of snapshot) {
        rows.set(key, value);
      }
      mutations.length = 0;
      mutations.push(...mutSnapshot);
      throw error;
    } finally {
      release();
    }
  };

  return { rows, mutations, transaction };
}

describe("runConfirmedWrite", () => {
  test("claims via Agent A then mutates once; UNIQUE replay is ALREADY_CONSUMED without a second mutation", async () => {
    const engine = createFakeEngine();
    let createCalls = 0;

    const first = await runConfirmedWrite(createFollowUpInput, {
      transaction: engine.transaction,
      claim: claimAiActionConsumption,
      createFollowUp: async () => {
        createCalls += 1;
        engine.mutations.push({ followUpId: "fu_1" });
        return serviceOk({ followUpId: "fu_1", companyId: "co_atelier" });
      },
      purge: async () => ({ count: 0 }),
    });
    const second = await runConfirmedWrite(createFollowUpInput, {
      transaction: engine.transaction,
      claim: claimAiActionConsumption,
      createFollowUp: async () => {
        createCalls += 1;
        engine.mutations.push({ followUpId: "fu_dup" });
        return serviceOk({ followUpId: "fu_dup", companyId: "co_atelier" });
      },
      purge: async () => ({ count: 0 }),
    });

    assert.equal(first.ok, true);
    if (first.ok) {
      assert.deepEqual(first.data, { followUpId: "fu_1" });
    }
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.equal(second.code, ALREADY_CONSUMED);
    }
    assert.equal(createCalls, 1);
    assert.equal(engine.rows.has("act_1"), true);
    assert.equal(engine.mutations.length, 1);
  });

  test("Promise.all same actionId: one winner mutates, loser is ALREADY_CONSUMED", async () => {
    const engine = createFakeEngine();
    let createCalls = 0;
    const deps = {
      transaction: engine.transaction,
      claim: claimAiActionConsumption,
      createFollowUp: async () => {
        createCalls += 1;
        engine.mutations.push({ followUpId: `fu_${createCalls}` });
        return serviceOk({ followUpId: `fu_${createCalls}`, companyId: "co_atelier" });
      },
      purge: async () => ({ count: 0 }),
    };

    const [left, right] = await Promise.all([
      runConfirmedWrite(createFollowUpInput, deps),
      runConfirmedWrite(createFollowUpInput, deps),
    ]);

    const codes = [left, right].map((result) => (result.ok ? "ok" : result.code)).sort();
    assert.deepEqual(codes, [ALREADY_CONSUMED, "ok"]);
    assert.equal(createCalls, 1);
    assert.equal(engine.rows.size, 1);
  });

  test("métier throw rolls back consumption so the token is retryable", async () => {
    const engine = createFakeEngine();
    let createCalls = 0;

    const failed = await runConfirmedWrite(createFollowUpInput, {
      transaction: engine.transaction,
      claim: claimAiActionConsumption,
      createFollowUp: async () => {
        createCalls += 1;
        engine.mutations.push({ followUpId: "fu_should_roll_back" });
        throw new Error("db down");
      },
      purge: async () => ({ count: 0 }),
    });

    assert.equal(failed.ok, false);
    if (!failed.ok) {
      assert.equal(failed.code, "INTERNAL");
    }
    assert.equal(engine.rows.size, 0);
    assert.equal(engine.mutations.length, 0);

    const retried = await runConfirmedWrite(createFollowUpInput, {
      transaction: engine.transaction,
      claim: claimAiActionConsumption,
      createFollowUp: async () => {
        createCalls += 1;
        engine.mutations.push({ followUpId: "fu_retry" });
        return serviceOk({ followUpId: "fu_retry", companyId: "co_atelier" });
      },
      purge: async () => ({ count: 0 }),
    });

    assert.equal(retried.ok, true);
    if (retried.ok) {
      assert.deepEqual(retried.data, { followUpId: "fu_retry" });
    }
    assert.equal(createCalls, 2);
    assert.equal(engine.rows.has("act_1"), true);
  });

  test("métier NOT_FOUND aborts the transaction before commit (claim rolled back)", async () => {
    const engine = createFakeEngine();
    const failed = await runConfirmedWrite(createFollowUpInput, {
      transaction: engine.transaction,
      claim: claimAiActionConsumption,
      createFollowUp: async () => serviceFail("NOT_FOUND", "Entreprise introuvable."),
      purge: async () => ({ count: 0 }),
    });
    assert.equal(failed.ok, false);
    if (!failed.ok) {
      assert.equal(failed.code, "NOT_FOUND");
    }
    assert.equal(engine.rows.size, 0);
  });

  test("claim runs before métier; unique loss never calls the service", async () => {
    const engine = createFakeEngine();
    const order: string[] = [];

    await runConfirmedWrite(createFollowUpInput, {
      transaction: engine.transaction,
      claim: async (tx, input) => {
        order.push("claim");
        await claimAiActionConsumption(tx, input);
      },
      createFollowUp: async () => {
        order.push("metier");
        return serviceOk({ followUpId: "fu_1", companyId: "co_atelier" });
      },
      purge: async () => ({ count: 0 }),
    });

    let metierOnReplay = 0;
    const replay = await runConfirmedWrite(createFollowUpInput, {
      transaction: engine.transaction,
      claim: async (tx, input) => {
        order.push("claim");
        await claimAiActionConsumption(tx, input);
      },
      createFollowUp: async () => {
        metierOnReplay += 1;
        order.push("metier");
        return serviceOk({ followUpId: "fu_2", companyId: "co_atelier" });
      },
      purge: async () => ({ count: 0 }),
    });

    assert.deepEqual(order, ["claim", "metier", "claim"]);
    assert.equal(replay.ok, false);
    assert.equal(metierOnReplay, 0);
  });

  test("successful confirm purges expired rows outside the write transaction", async () => {
    const engine = createFakeEngine();
    let purgeCalls = 0;
    let purgeDuringTx = false;

    const result = await runConfirmedWrite(createFollowUpInput, {
      transaction: async (fn) => {
        const value = await engine.transaction(fn);
        if (purgeCalls > 0) {
          purgeDuringTx = true;
        }
        return value;
      },
      claim: claimAiActionConsumption,
      createFollowUp: async () => serviceOk({ followUpId: "fu_1", companyId: "co_atelier" }),
      purge: async () => {
        purgeCalls += 1;
        return { count: 0 };
      },
    });

    assert.equal(result.ok, true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(purgeCalls, 1);
    assert.equal(purgeDuringTx, false);
  });
});
