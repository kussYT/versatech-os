import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assessDeclaredStepChange } from "@/lib/crm/journey-cursor";

describe("assessDeclaredStepChange", () => {
  it("autorise un retour sans incohérence quand aucun fait n'est plus avancé", () => {
    const result = assessDeclaredStepChange({
      target: "CONTACT",
      currentDeclared: "DEVIS",
      factsFurthestCompleted: null,
    });
    assert.equal(result.inconsistent, false);
    assert.equal(result.unchanged, false);
  });

  it("détecte une incohérence quand on revient avant des faits attestés", () => {
    const result = assessDeclaredStepChange({
      target: "CONTACT",
      currentDeclared: "DEVELOPPEMENT",
      factsFurthestCompleted: "SIGNATURE",
    });
    assert.equal(result.inconsistent, true);
    assert.deepEqual(result.completedFactsAfter, ["RDV", "DEVIS", "SIGNATURE"]);
  });

  it("ne signale pas d'incohérence pour un avancement ou un même niveau", () => {
    assert.equal(
      assessDeclaredStepChange({
        target: "ACOMPTE",
        currentDeclared: "SIGNATURE",
        factsFurthestCompleted: "SIGNATURE",
      }).inconsistent,
      false,
    );
    assert.equal(
      assessDeclaredStepChange({
        target: "SIGNATURE",
        currentDeclared: "SIGNATURE",
        factsFurthestCompleted: "SIGNATURE",
      }).unchanged,
      true,
    );
  });
});
