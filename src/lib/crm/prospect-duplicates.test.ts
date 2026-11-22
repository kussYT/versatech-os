import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatProspectDuplicateSubtitle,
  prospectDuplicateLabel,
} from "@/lib/crm/prospect-duplicates";

describe("prospect duplicate labels", () => {
  it("formats lifecycle and city", () => {
    assert.equal(
      formatProspectDuplicateSubtitle({
        id: "c1",
        name: "ALEX'CEPTION",
        city: "Raismes",
        lifecycleStatus: "CLIENT",
      }),
      "Client — Raismes",
    );
  });

  it("omits city when missing", () => {
    assert.equal(
      formatProspectDuplicateSubtitle({
        id: "c2",
        name: "Atelier",
        city: null,
        lifecycleStatus: "LEAD",
      }),
      "Lead",
    );
  });

  it("builds the full suggestion label", () => {
    assert.equal(
      prospectDuplicateLabel({
        id: "c1",
        name: "ALEX'CEPTION",
        city: "Raismes",
        lifecycleStatus: "CLIENT",
      }),
      "ALEX'CEPTION — Client — Raismes",
    );
  });
});
