import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  averageMoney,
  centsToMoneyString,
  formatCents,
  multiplyMoney,
  normalizeMoney,
  parseCents,
  parseMoneyToCents,
  subtractMoney,
  sumMoney,
  tryParseMoneyToCents,
  weightedMoney,
} from "./money";

describe("money cents", () => {
  it("parse les montants Decimal(12,2) sans Number", () => {
    assert.equal(parseMoneyToCents("14500.00"), BigInt(1450000));
    assert.equal(parseMoneyToCents("14500"), BigInt(1450000));
    assert.equal(parseMoneyToCents("5800.5"), BigInt(580050));
    assert.equal(parseMoneyToCents("0.10"), BigInt(10));
    assert.equal(centsToMoneyString(BigInt(1450000)), "14500.00");
    assert.equal(centsToMoneyString(BigInt(10)), "0.10");
  });

  it("accepte une virgule française et un Decimal-like", () => {
    assert.equal(parseMoneyToCents("1280,50"), BigInt(128050));
    assert.equal(parseMoneyToCents({ toString: () => "8700.00" }), BigInt(870000));
  });

  it("refuse plus de deux décimales", () => {
    assert.equal(tryParseMoneyToCents("10.123"), null);
    assert.equal(tryParseMoneyToCents("abc"), null);
  });

  it("additionne 0.10 + 0.20 en centimes, pas en float", () => {
    assert.equal(sumMoney(["0.10", "0.20"]), "0.30");
    assert.equal(sumMoney(["89.50", "10.50"]), "100.00");
    assert.equal(sumMoney([]), "0.00");
    assert.notEqual(0.1 + 0.2, 0.3);
  });

  it("soustrait CA signé − encaissé", () => {
    assert.equal(subtractMoney("14500.00", "5800.00"), "8700.00");
  });

  it("normalise et alias Maintenance", () => {
    assert.equal(parseCents("89"), BigInt(8900));
    assert.equal(parseCents("89.5"), BigInt(8950));
    assert.equal(normalizeMoney("89"), "89.00");
    assert.equal(normalizeMoney("10.5"), "10.50");
    assert.equal(formatCents(BigInt(-105)), "-1.05");
  });

  it("multiplie par un entier (ARR = MRR × 12)", () => {
    assert.equal(multiplyMoney("89.50", 12), "1074.00");
    assert.equal(multiplyMoney("0.33", 12), "3.96");
  });

  it("pondère un montant par une probabilité entière", () => {
    assert.equal(weightedMoney("10000.00", 70), "7000.00");
    assert.equal(weightedMoney("4200.00", 20), "840.00");
    assert.equal(weightedMoney("14500.00", 100), "14500.00");
  });

  it("calcule une moyenne en centimes", () => {
    assert.equal(averageMoney("0", 0), null);
    assert.equal(averageMoney("14500.00", 1), "14500.00");
    assert.equal(averageMoney(sumMoney(["100.00", "200.00"]), 2), "150.00");
  });
});
