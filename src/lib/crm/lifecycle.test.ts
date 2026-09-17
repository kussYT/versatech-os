import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allowedManualLifecycles,
  isClientJustified,
  lifecycleAfterInteraction,
  lifecycleAfterLeavingWon,
  lifecycleAfterOpportunityCreated,
  lifecycleAfterWon,
  nextLifecycleAfterOpportunityStageChange,
  validateManualLifecycle,
  type CompanyLifecycleFacts,
} from "./lifecycle";

function facts(overrides: Partial<CompanyLifecycleFacts> = {}): CompanyLifecycleFacts {
  return {
    current: "LEAD",
    wonOpportunityCount: 0,
    acceptedQuoteCount: 0,
    projectCount: 0,
    openOpportunityCount: 0,
    ...overrides,
  };
}

describe("lifecycle auto", () => {
  it("passe LEAD → CONTACTED sur interaction commerciale", () => {
    assert.equal(lifecycleAfterInteraction("LEAD", "CALL"), "CONTACTED");
    assert.equal(lifecycleAfterInteraction("LEAD", "NOTE"), null);
    assert.equal(lifecycleAfterInteraction("CLIENT", "CALL"), null);
  });

  it("passe un prospect en OPPORTUNITY à la création", () => {
    assert.equal(lifecycleAfterOpportunityCreated("LEAD"), "OPPORTUNITY");
    assert.equal(lifecycleAfterOpportunityCreated("CLIENT"), null);
  });

  it("passe en CLIENT sur WON", () => {
    assert.equal(lifecycleAfterWon("OPPORTUNITY"), "CLIENT");
    assert.equal(lifecycleAfterWon("CLIENT"), null);
    assert.equal(lifecycleAfterWon("INACTIVE"), "CLIENT");
  });
});

describe("rollback WON", () => {
  it("ne rétrograde pas un client encore justifié (autre WON, devis, projet)", () => {
    assert.equal(
      lifecycleAfterLeavingWon(
        "CLIENT",
        facts({ current: "CLIENT", wonOpportunityCount: 1 }),
      ),
      null,
    );
    assert.equal(
      lifecycleAfterLeavingWon(
        "CLIENT",
        facts({ current: "CLIENT", acceptedQuoteCount: 1 }),
      ),
      null,
    );
    assert.equal(
      lifecycleAfterLeavingWon(
        "CLIENT",
        facts({ current: "CLIENT", projectCount: 1 }),
      ),
      null,
    );
  });

  it("rétrograde seulement un CLIENT qui n'a plus de justification", () => {
    assert.equal(
      lifecycleAfterLeavingWon(
        "CLIENT",
        facts({ current: "CLIENT", openOpportunityCount: 1 }),
      ),
      "OPPORTUNITY",
    );
    assert.equal(
      lifecycleAfterLeavingWon("CLIENT", facts({ current: "CLIENT" })),
      "QUALIFIED",
    );
  });

  it("ne touche pas INACTIVE sur rollback WON", () => {
    assert.equal(
      lifecycleAfterLeavingWon("INACTIVE", facts({ current: "INACTIVE" })),
      null,
    );
  });

  it("enchaîne WON puis rollback dans nextLifecycleAfterOpportunityStageChange", () => {
    assert.equal(
      nextLifecycleAfterOpportunityStageChange({
        currentCompany: "OPPORTUNITY",
        fromStage: "QUOTE",
        toStage: "WON",
        factsAfterChange: facts({ current: "OPPORTUNITY", wonOpportunityCount: 1 }),
      }),
      "CLIENT",
    );

    assert.equal(
      nextLifecycleAfterOpportunityStageChange({
        currentCompany: "CLIENT",
        fromStage: "WON",
        toStage: "QUOTE",
        factsAfterChange: facts({ current: "CLIENT", projectCount: 1 }),
      }),
      null,
    );

    assert.equal(
      nextLifecycleAfterOpportunityStageChange({
        currentCompany: "CLIENT",
        fromStage: "WON",
        toStage: "LOST",
        factsAfterChange: facts({ current: "CLIENT" }),
      }),
      "QUALIFIED",
    );
  });
});

describe("lifecycle manuel", () => {
  it("interdit CLIENT sans justification", () => {
    const prospect = facts({ current: "QUALIFIED" });
    assert.equal(isClientJustified(prospect), false);
    assert.equal(validateManualLifecycle("CLIENT", prospect).ok, false);
    assert.ok(!allowedManualLifecycles(prospect).includes("CLIENT"));
  });

  it("autorise CLIENT si projet / devis / WON", () => {
    const withProject = facts({ current: "QUALIFIED", projectCount: 1 });
    assert.equal(validateManualLifecycle("CLIENT", withProject).ok, true);
  });

  it("empêche de dégrader un CLIENT justifié hors INACTIVE", () => {
    const client = facts({
      current: "CLIENT",
      wonOpportunityCount: 1,
      projectCount: 1,
    });
    assert.equal(validateManualLifecycle("LEAD", client).ok, false);
    assert.equal(validateManualLifecycle("LOST", client).ok, false);
    assert.equal(validateManualLifecycle("INACTIVE", client).ok, true);
    assert.deepEqual(allowedManualLifecycles(client), ["CLIENT", "INACTIVE"]);
  });

  it("autorise OPPORTUNITY seulement s'il reste une opportunité ouverte", () => {
    const withoutOpen = facts({ current: "QUALIFIED" });
    assert.equal(validateManualLifecycle("OPPORTUNITY", withoutOpen).ok, false);

    const withOpen = facts({ current: "QUALIFIED", openOpportunityCount: 1 });
    assert.equal(validateManualLifecycle("OPPORTUNITY", withOpen).ok, true);
  });

  it("permet de réparer un CLIENT orphelin (données incohérentes)", () => {
    const orphan = facts({ current: "CLIENT" });
    assert.equal(validateManualLifecycle("QUALIFIED", orphan).ok, true);
    assert.equal(validateManualLifecycle("LOST", orphan).ok, true);
  });
});
