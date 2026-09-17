import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  effectiveProbability,
  probabilityForWrite,
  probabilityFromStage,
  weightedValue,
} from "./probability";

describe("probability", () => {
  it("mappe chaque stage ouvert vers 1–100 et LOST vers 0", () => {
    assert.equal(probabilityFromStage("TO_CONTACT"), 20);
    assert.equal(probabilityFromStage("MEETING"), 55);
    assert.equal(probabilityFromStage("QUOTE"), 70);
    assert.equal(probabilityFromStage("WON"), 100);
    assert.equal(probabilityFromStage("LOST"), 0);
  });

  it("conserve une saisie manuelle bornée 0–100", () => {
    assert.equal(probabilityForWrite("MEETING", 40), 40);
    assert.equal(probabilityForWrite("MEETING", null), 55);
    assert.equal(probabilityForWrite("QUOTE", 150), 100);
    assert.equal(probabilityForWrite("QUOTE", -4), 0);
  });

  it("traite un 0 silencieux comme non renseigné sauf LOST", () => {
    assert.equal(effectiveProbability("MEETING", 0), 55);
    assert.equal(effectiveProbability("MEETING", 40), 40);
    assert.equal(effectiveProbability("WON", 0), 100);
    assert.equal(effectiveProbability("LOST", 0), 0);
    assert.equal(effectiveProbability("LOST", 80), 0);
  });

  it("calcule le pipeline pondéré (BR-017)", () => {
    assert.equal(weightedValue(10_000, 70), 7000);
    assert.equal(weightedValue(4200, 20), 840);
    assert.equal(weightedValue(0, 100), 0);
  });
});
