/**
 * Wave 6 — UNIQUE `actionId` claim (`claimAiActionConsumption`).
 *
 * Fake tx only: Map set-if-absent stands in for Postgres UNIQUE / Prisma P2002.
 * No live PostgreSQL, no ALEX'CEPTION writes.
 *
 * Claim is INSERT inside a transaction, never SELECT-then-INSERT.
 * P2002 (and PG 23505) → AlreadyConsumedError / ALREADY_CONSUMED.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import {
  claimAiActionConsumption,
  type AiActionConsumptionClaimTx,
  type ClaimAiActionConsumptionInput,
} from "./claim";
import { ALREADY_CONSUMED, AlreadyConsumedError, isAlreadyConsumedError } from "./errors";
import { isUniqueConstraintViolation } from "./unique-violation";

const EXPIRES_AT = new Date("2026-09-19T10:05:00.000Z");
const SAMPLE: ClaimAiActionConsumptionInput = {
  actionId: "act_1",
  actorId: "user_session",
  toolName: "createFollowUp",
  expiresAt: EXPIRES_AT,
};

type ConsumptionRow = {
  actionId: string;
  actorId: string;
  toolName: string;
};

function p2002(): Error & { code: "P2002" } {
  return Object.assign(new Error("Unique constraint failed on the fields: (`actionId`)"), {
    code: "P2002" as const,
  });
}

function uniqueClaimTx() {
  const rows = new Map<string, ConsumptionRow>();
  const tx: AiActionConsumptionClaimTx = {
    aiActionConsumption: {
      create: async ({ data }) => {
        await Promise.resolve();
        if (rows.has(data.actionId)) {
          throw p2002();
        }
        rows.set(data.actionId, {
          actionId: data.actionId,
          actorId: data.actorId,
          toolName: data.toolName,
        });
        return data;
      },
    },
  };
  return { tx, rows };
}

async function settleClaim(
  tx: AiActionConsumptionClaimTx,
  input: ClaimAiActionConsumptionInput = SAMPLE,
): Promise<{ ok: true } | { ok: false; code: typeof ALREADY_CONSUMED }> {
  try {
    await claimAiActionConsumption(tx, input);
    return { ok: true };
  } catch (error) {
    if (isAlreadyConsumedError(error)) {
      return { ok: false, code: ALREADY_CONSUMED };
    }
    throw error;
  }
}

const REPO_ROOT = path.resolve(process.cwd());

describe("claimAiActionConsumption UNIQUE contract", () => {
  test("INSERT of a fresh actionId succeeds exactly once", async () => {
    const { tx, rows } = uniqueClaimTx();
    await claimAiActionConsumption(tx, SAMPLE);
    assert.equal(rows.size, 1);
    assert.equal(rows.get("act_1")?.actorId, "user_session");
    assert.equal(rows.get("act_1")?.toolName, "createFollowUp");
  });

  test("P2002 on the same actionId throws AlreadyConsumedError (ALREADY_CONSUMED)", async () => {
    const { tx, rows } = uniqueClaimTx();
    await claimAiActionConsumption(tx, SAMPLE);
    await assert.rejects(
      () => claimAiActionConsumption(tx, SAMPLE),
      (error: unknown) => {
        assert.equal(isAlreadyConsumedError(error), true);
        assert.equal((error as AlreadyConsumedError).code, ALREADY_CONSUMED);
        assert.equal((error as AlreadyConsumedError).actionId, "act_1");
        return true;
      },
    );
    assert.equal(rows.size, 1);
  });

  test("Promise.all two claim() on the same actionId → 1 success + 1 ALREADY_CONSUMED", async () => {
    const { tx, rows } = uniqueClaimTx();
    const input = { ...SAMPLE, actionId: "act_race" };
    const results = await Promise.all([settleClaim(tx, input), settleClaim(tx, input)]);
    assert.equal(results.filter((row) => row.ok).length, 1);
    assert.equal(results.filter((row) => !row.ok && row.code === ALREADY_CONSUMED).length, 1);
    assert.equal(rows.size, 1);
  });

  test("SELECT-then-INSERT with a yield between lookup and write is not UNIQUE (two successes)", async () => {
    const rows = new Map<string, true>();
    async function naiveSelectThenInsert(actionId: string): Promise<boolean> {
      const existing = rows.get(actionId);
      await Promise.resolve();
      if (existing) {
        return false;
      }
      rows.set(actionId, true);
      return true;
    }

    const raced = await Promise.all([
      naiveSelectThenInsert("act_naive"),
      naiveSelectThenInsert("act_naive"),
    ]);
    assert.equal(
      raced.filter(Boolean).length,
      2,
      "SELECT-then-INSERT across an await must not be the production claim",
    );
  });

  test("UNIQUE INSERT after the same yield still admits only one claim", async () => {
    const { tx, rows } = uniqueClaimTx();
    const input = { ...SAMPLE, actionId: "act_unique" };
    async function claimAfterYield() {
      await Promise.resolve();
      return settleClaim(tx, input);
    }
    const results = await Promise.all([claimAfterYield(), claimAfterYield()]);
    assert.equal(results.filter((row) => row.ok).length, 1);
    assert.equal(results.filter((row) => !row.ok).length, 1);
    assert.equal(rows.size, 1);
  });

  test("isUniqueConstraintViolation accepts Prisma P2002 and Postgres 23505", () => {
    assert.equal(isUniqueConstraintViolation(p2002()), true);
    assert.equal(isUniqueConstraintViolation({ code: "23505" }), true);
    assert.equal(isUniqueConstraintViolation({ cause: { code: "P2002" } }), true);
    assert.equal(isUniqueConstraintViolation(new Error("not unique")), false);
  });
});

describe("production claim helper source contract", () => {
  test("claimAiActionConsumption INSERTs and maps unique violations to AlreadyConsumedError", () => {
    const claimSource = readFileSync(
      path.join(REPO_ROOT, "src", "lib", "services", "ai-action-consumption", "claim.ts"),
      "utf8",
    );
    const uniqueSource = readFileSync(
      path.join(REPO_ROOT, "src", "lib", "services", "ai-action-consumption", "unique-violation.ts"),
      "utf8",
    );
    const runSource = readFileSync(
      path.join(REPO_ROOT, "src", "lib", "services", "ai-action-consumption", "run-confirmed-write.ts"),
      "utf8",
    );

    assert.match(claimSource, /export async function claimAiActionConsumption/);
    assert.match(claimSource, /aiActionConsumption\.create/);
    assert.match(claimSource, /AlreadyConsumedError/);
    assert.doesNotMatch(claimSource, /findUnique/);
    assert.doesNotMatch(claimSource, /findFirst/);
    assert.equal(/findUnique[\s\S]{0,400}\.create\s*\(/.test(claimSource), false);

    assert.match(uniqueSource, /P2002/);
    assert.match(uniqueSource, /23505/);

    assert.match(runSource, /claimAiActionConsumption/);
    assert.match(runSource, /\$transaction|transaction/);
    assert.match(runSource, /ALREADY_CONSUMED/);
  });
});
