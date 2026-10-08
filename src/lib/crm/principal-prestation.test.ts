import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { selectPrincipalPrestation } from "@/lib/crm/principal-prestation";

const now = new Date("2026-10-08T12:00:00.000Z");

describe("selectPrincipalPrestation", () => {
  it("prend le projet en cours, pas le projet seulement mis à jour plus récemment", () => {
    const selected = selectPrincipalPrestation({
      now,
      projects: [
        {
          id: "prj_planned",
          name: "Brouillon récent",
          status: "PLANNED",
          opportunityId: null,
          updatedAt: "2026-10-08T10:00:00.000Z",
          createdAt: "2026-10-08T10:00:00.000Z",
        },
        {
          id: "prj_active",
          name: "Site en cours",
          status: "ACTIVE",
          opportunityId: "opp_site",
          startDate: "2026-09-01T00:00:00.000Z",
          updatedAt: "2026-09-02T00:00:00.000Z",
          createdAt: "2026-09-01T00:00:00.000Z",
        },
      ],
      opportunities: [
        {
          id: "opp_site",
          title: "Site vitrine",
          stage: "WON",
          updatedAt: "2026-10-01T00:00:00.000Z",
        },
        {
          id: "opp_new",
          title: "Seconde offre",
          stage: "QUOTE",
          updatedAt: "2026-10-08T00:00:00.000Z",
        },
      ],
    });

    assert.equal(selected?.projectId, "prj_active");
    assert.equal(selected?.opportunityId, "opp_site");
    assert.equal(selected?.label, "Site en cours");
    assert.equal(selected?.source, "in_development");
  });

  it("sans projet, préfère l'opportunité ouverte la plus récente", () => {
    const selected = selectPrincipalPrestation({
      now,
      projects: [],
      opportunities: [
        {
          id: "opp_won",
          title: "Ancien gagné",
          stage: "WON",
          updatedAt: "2026-10-08T00:00:00.000Z",
        },
        {
          id: "opp_old",
          title: "Devis ancien",
          stage: "QUOTE",
          updatedAt: "2026-08-01T00:00:00.000Z",
        },
        {
          id: "opp_new",
          title: "Devis récent",
          stage: "QUOTE",
          updatedAt: "2026-09-01T00:00:00.000Z",
        },
      ],
    });

    assert.equal(selected?.opportunityId, "opp_new");
    assert.equal(selected?.projectId, null);
    assert.equal(selected?.label, "Devis récent");
  });

  it("départage deux opportunités à la même date par l'identifiant", () => {
    const first = selectPrincipalPrestation({
      projects: [],
      opportunities: [
        { id: "opp_a", title: "A", stage: "MEETING", updatedAt: "2026-09-01T00:00:00.000Z" },
        { id: "opp_b", title: "B", stage: "MEETING", updatedAt: "2026-09-01T00:00:00.000Z" },
      ],
    });
    const second = selectPrincipalPrestation({
      projects: [],
      opportunities: [
        { id: "opp_b", title: "B", stage: "MEETING", updatedAt: "2026-09-01T00:00:00.000Z" },
        { id: "opp_a", title: "A", stage: "MEETING", updatedAt: "2026-09-01T00:00:00.000Z" },
      ],
    });

    assert.equal(first?.opportunityId, "opp_b");
    assert.equal(second?.opportunityId, first?.opportunityId);
  });

  it("sans prestation, ne choisit rien", () => {
    assert.equal(selectPrincipalPrestation({ projects: [], opportunities: [] }), null);
  });
});
