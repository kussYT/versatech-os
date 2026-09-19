import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ZERO_MONEY } from "@/lib/money";
import type { PipelineOpportunityCard, PipelineOverviewLoad } from "@/lib/queries/opportunities";
import { mapPipeline, mapPipelineCard, moneyTotalsForStage } from "./map";
import {
  EMPTY_PIPELINE_COUNTS,
  PIPELINE_LIMITS,
  emptyPipeline,
  getPipelineInputSchema,
  isPlainJsonValue,
  parseGetPipelineInput,
  parsePipeline,
  pipelineCardSchema,
  pipelineSchema,
  requireServiceActor,
  serializePipeline,
} from "./schema";

const actor = {
  id: "user_1",
  name: "Marius",
  email: "marius@versatech.example",
  role: "ADMIN" as const,
};

function sampleCard(): PipelineOpportunityCard {
  return {
    id: "opp_1",
    title: "Site vitrine",
    stage: "QUOTE",
    estimatedValue: "14500",
    probability: 70,
    company: {
      id: "co_lead",
      name: "Atelier Nord",
      industry: "Menuiserie",
      city: "Lyon",
    },
    nextFollowUp: { title: "Relance devis", dueAt: "2026-09-19T07:00:00.000Z" },
    lastInteraction: { type: "CALL", occurredAt: "2026-09-18T14:00:00.000Z" },
  };
}

function sampleOverview(): PipelineOverviewLoad {
  return {
    counts: { ...EMPTY_PIPELINE_COUNTS, QUOTE: 1, WON: 2 },
    openCount: 1,
    brutTotal: 14500,
    weightedTotal: 10150,
    brutTotalMoney: "14500.00",
    weightedTotalMoney: "10150.00",
  };
}

describe("OpportunityService getPipeline schema", () => {
  test("empty pipeline is valid with canonical money", () => {
    const empty = emptyPipeline();
    assert.equal(empty.openCount, 0);
    assert.equal(empty.brutTotal, ZERO_MONEY);
    assert.equal(empty.stages.length, 6);
    assert.equal(pipelineSchema.safeParse(empty).success, true);
  });

  test("JSON roundtrip uses money strings and omits industry/href", () => {
    const mapped = mapPipeline({
      overview: sampleOverview(),
      valueRows: [{ stage: "QUOTE", estimatedValue: "14500", probability: 70 }],
      cardsByStage: new Map([["QUOTE", [sampleCard()]]]),
      openOnly: true,
      limitPerStage: 8,
    });
    const roundtrip = JSON.parse(JSON.stringify(mapped)) as unknown;
    assert.deepEqual(roundtrip, mapped);
    assert.deepEqual(parsePipeline(roundtrip), mapped);
    assert.equal(isPlainJsonValue(mapped), true);
    const json = serializePipeline(mapped);
    assert.equal(json.includes('"industry"'), false);
    assert.equal(json.includes('"href"'), false);
    assert.equal(mapped.brutTotal, "14500.00");
    assert.equal(typeof mapped.brutTotal, "string");
    assert.equal(typeof mapped.weightedTotal, "string");
  });

  test("limitPerStage default 8 max 15; number totals fail", () => {
    assert.equal(PIPELINE_LIMITS.defaultPerStage, 8);
    assert.equal(PIPELINE_LIMITS.maxPerStage, 15);
    assert.equal(parseGetPipelineInput({}).openOnly, true);
    assert.equal(parseGetPipelineInput({}).limitPerStage, 8);
    assert.equal(getPipelineInputSchema.safeParse({ limitPerStage: 16 }).success, false);

    const sample = emptyPipeline();
    assert.equal(
      pipelineSchema.safeParse({ ...sample, brutTotal: 14500 }).success,
      false,
    );
  });

  test("company.industry on a card is rejected", () => {
    const card = mapPipelineCard(sampleCard());
    assert.equal("industry" in card.company, false);
    assert.equal(
      pipelineCardSchema.safeParse({
        ...card,
        company: { ...card.company, industry: "Menuiserie" },
      }).success,
      false,
    );
  });

  test("weightedMoney uses integer probability", () => {
    const card = mapPipelineCard(sampleCard());
    assert.equal(card.estimatedValue, "14500.00");
    assert.equal(card.probability, 70);
    assert.equal(card.weightedValue, "10150.00");
    assert.deepEqual(moneyTotalsForStage([{ stage: "QUOTE", estimatedValue: "14500", probability: 70 }], "QUOTE"), {
      estimatedTotal: "14500.00",
      weightedTotal: "10150.00",
    });
  });

  test("requireServiceActor throws when actor id is missing, without redirect", () => {
    assert.throws(() => requireServiceActor({ ...actor, id: "" }), /Acteur requis/);
    assert.throws(() => requireServiceActor(null), /Acteur requis/);
    assert.doesNotThrow(() => requireServiceActor(actor));
  });
});
