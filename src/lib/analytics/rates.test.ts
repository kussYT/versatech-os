import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatRate, ratePercent } from "./rates";

describe("taux d'effectif", () => {
  it("exprime un taux à une décimale", () => {
    assert.equal(ratePercent(1, 4), 25);
    assert.equal(ratePercent(2, 3), 66.7);
    assert.equal(ratePercent(0, 0), null);
    assert.equal(formatRate(25), "25 %");
    assert.equal(formatRate(null), "—");
  });
});
