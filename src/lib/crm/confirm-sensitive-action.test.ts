import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  SENSITIVE_ACTION_CONFIRMS,
  confirmSensitiveAction,
  preventUnconfirmedSubmit,
} from "./confirm-sensitive-action";

describe("confirmations UX des mutations sensibles", () => {
  test("covers the audited financial, cancel, unlink and strong workflow actions", () => {
    assert.match(SENSITIVE_ACTION_CONFIRMS.quoteAccepted, /Accepter ce devis/);
    assert.match(SENSITIVE_ACTION_CONFIRMS.quoteAccepted, /CA signé/);
    assert.match(SENSITIVE_ACTION_CONFIRMS.quoteRejected, /Refuser ce devis/);
    assert.match(SENSITIVE_ACTION_CONFIRMS.paymentPaid, /encaissé/);
    assert.match(SENSITIVE_ACTION_CONFIRMS.paymentCanceled, /Annuler ce paiement/);
    assert.match(SENSITIVE_ACTION_CONFIRMS.maintenanceActivate, /MRR/);
    assert.match(SENSITIVE_ACTION_CONFIRMS.maintenancePause, /Suspendre/);
    assert.match(SENSITIVE_ACTION_CONFIRMS.maintenanceEnd, /Terminer ce contrat/);
    assert.match(SENSITIVE_ACTION_CONFIRMS.projectCompleted, /terminé/);
    assert.match(SENSITIVE_ACTION_CONFIRMS.projectArchived, /Archiver/);
    assert.match(
      SENSITIVE_ACTION_CONFIRMS.unlinkGithub("kussYT/demo"),
      /kussYT\/demo/,
    );
    assert.match(
      SENSITIVE_ACTION_CONFIRMS.removeTourCompany("Studio Test"),
      /Studio Test/,
    );
  });

  test("does not mention opportunity WON/LOST pipeline confirms", () => {
    const catalog = JSON.stringify(SENSITIVE_ACTION_CONFIRMS);
    assert.equal(catalog.includes("Passer cette opportunité en Gagné"), false);
    assert.equal(catalog.includes("Raison de la perte"), false);
  });

  test("blocks submit when the user cancels", () => {
    let prevented = false;
    preventUnconfirmedSubmit("Continuer ?", () => false)({
      preventDefault: () => {
        prevented = true;
      },
    });
    assert.equal(prevented, true);
    assert.equal(confirmSensitiveAction("Continuer ?", () => false), false);
  });

  test("lets the form submit when the user confirms", () => {
    preventUnconfirmedSubmit("Continuer ?", () => true)({
      preventDefault: () => {
        throw new Error("should not preventDefault");
      },
    });
    assert.equal(confirmSensitiveAction("Continuer ?", () => true), true);
  });
});
