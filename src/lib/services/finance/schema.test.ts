import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { FinanceTotals } from "@/lib/finance";
import { ZERO_MONEY } from "@/lib/money";
import { mapFinanceSnapshot } from "./map";
import {
  emptyFinanceSnapshot,
  financeSnapshotSchema,
  isPlainJsonValue,
  parseFinanceSnapshot,
  parseGetFinanceSnapshotInput,
  requireServiceActor,
  serializeFinanceSnapshot,
} from "./schema";

const actor = {
  id: "user_1",
  name: "Marius",
  email: "marius@versatech.example",
  role: "ADMIN" as const,
};

function sampleTotals(): FinanceTotals {
  return {
    signed: "12000.00",
    collected: "4000.00",
    remaining: "8000.00",
    pending: "1500.00",
    overdue: "500.00",
    pendingCount: 2,
    overdueCount: 1,
    paidCount: 3,
    paymentCount: 6,
  };
}

describe("FinanceService getFinanceSnapshot schema", () => {
  test("empty snapshot uses canonical zeros", () => {
    const empty = emptyFinanceSnapshot();
    assert.equal(empty.signed, ZERO_MONEY);
    assert.equal(empty.mrr, ZERO_MONEY);
    assert.equal(empty.arr, ZERO_MONEY);
    assert.equal(empty.scope.companyId, null);
    assert.equal(financeSnapshotSchema.safeParse(empty).success, true);
  });

  test("JSON roundtrip is money strings without write fields", () => {
    const mapped = mapFinanceSnapshot({
      totals: sampleTotals(),
      mrr: { mrr: "900.00", arr: "10800.00", activeCount: 2 },
      companyId: "co_1",
    });
    const roundtrip = JSON.parse(JSON.stringify(mapped)) as unknown;
    assert.deepEqual(roundtrip, mapped);
    assert.deepEqual(parseFinanceSnapshot(roundtrip), mapped);
    assert.equal(isPlainJsonValue(mapped), true);
    const json = serializeFinanceSnapshot(mapped);
    assert.equal(json.includes("externalReference"), false);
    assert.equal(json.includes("paymentId"), false);
    assert.equal(json.includes('"payments"'), false);
    assert.equal(json.includes("quoteId"), false);
    assert.equal(typeof mapped.signed, "string");
    assert.equal(typeof mapped.mrr, "string");
    assert.equal(typeof mapped.arr, "string");
  });

  test("write / line-item fields are rejected", () => {
    const sample = emptyFinanceSnapshot();
    assert.equal(
      financeSnapshotSchema.safeParse({
        ...sample,
        payments: [{ id: "pay_1", amount: "10.00", status: "PAID" }],
      }).success,
      false,
    );
    assert.equal(
      financeSnapshotSchema.safeParse({
        ...sample,
        externalReference: "VIR-1",
      }).success,
      false,
    );
    assert.equal(
      financeSnapshotSchema.safeParse({
        ...sample,
        paymentId: "pay_1",
      }).success,
      false,
    );
    assert.equal(
      financeSnapshotSchema.safeParse({
        ...sample,
        signed: 12000,
      }).success,
      false,
    );
    assert.equal(
      financeSnapshotSchema.safeParse({
        ...sample,
        createPayment: true,
      }).success,
      false,
    );
  });

  test("optional scope ids; empty id fails", () => {
    assert.deepEqual(parseGetFinanceSnapshotInput({}), {});
    assert.equal(
      parseGetFinanceSnapshotInput({ companyId: "co_1" }).companyId,
      "co_1",
    );
    assert.equal(
      financeSnapshotSchema.safeParse({
        ...emptyFinanceSnapshot(),
      }).success,
      true,
    );
  });

  test("requireServiceActor throws when actor id is missing, without redirect", () => {
    assert.throws(() => requireServiceActor({ ...actor, id: "" }), /Acteur requis/);
    assert.throws(() => requireServiceActor(null), /Acteur requis/);
    assert.doesNotThrow(() => requireServiceActor(actor));
  });
});
