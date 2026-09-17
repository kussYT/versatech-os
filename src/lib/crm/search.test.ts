import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  flattenSearchHits,
  groupSearchHits,
  isSearchableQuery,
  normalizeSearchQuery,
  searchQueryTokens,
  type SearchHit,
} from "./search";

describe("search helpers", () => {
  it("normalise et refuse les requêtes trop courtes", () => {
    assert.equal(normalizeSearchQuery("  Atelier   Horizon  "), "Atelier Horizon");
    assert.equal(isSearchableQuery("a"), false);
    assert.equal(isSearchableQuery("ab"), true);
    assert.equal(isSearchableQuery("  ab  "), true);
  });

  it("découpe les tokens pour les contacts multi-mots", () => {
    assert.deepEqual(searchQueryTokens("Jean Dupont"), ["Jean", "Dupont"]);
  });

  it("groupe les hits dans l'ordre des types et aplatit pour le clavier", () => {
    const hits: SearchHit[] = [
      {
        id: "p1",
        kind: "project",
        title: "Site",
        subtitle: "Atelier",
        href: "/projets/p1",
      },
      {
        id: "c1",
        kind: "company",
        title: "Atelier Horizon",
        subtitle: "Nantes",
        href: "/entreprises/c1",
      },
      {
        id: "k1",
        kind: "contact",
        title: "Inès Martin",
        subtitle: "Atelier Horizon",
        href: "/entreprises/c1",
      },
    ];

    const grouped = groupSearchHits("atelier", hits);
    assert.deepEqual(
      grouped.groups.map((group) => group.kind),
      ["company", "contact", "project"],
    );
    assert.equal(grouped.total, 3);
    assert.deepEqual(
      flattenSearchHits(grouped).map((hit) => hit.id),
      ["c1", "k1", "p1"],
    );
  });
});
