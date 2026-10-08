import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  contextualCommands,
  EMPTY_PALETTE_COMMANDS,
  emptySearchResults,
  flattenSearchHits,
  formatCompanySubtitle,
  formatOpportunityHit,
  formatQuoteHit,
  groupSearchHits,
  isCurrentSearch,
  isSearchableQuery,
  movePaletteIndex,
  normalizeSearchQuery,
  openStageCommands,
  screenAfterEscape,
  SEARCH_LIMIT_PER_KIND,
  searchNeedles,
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

  it("formate une entreprise partielle, une opportunité et un devis", () => {
    assert.equal(formatCompanySubtitle({ instagram: "maro.crea" }), "Instagram : @maro.crea");
    assert.equal(formatCompanySubtitle({ email: "maro@crea.test" }), "maro@crea.test");
    assert.equal(formatCompanySubtitle({ phone: "0600000000" }), "0600000000");
    assert.equal(formatCompanySubtitle({ lifecycleLabel: "Lead" }), "Lead");
    assert.equal(formatCompanySubtitle({}), "");
    assert.equal(formatOpportunityHit("Site vitrine", "Maro Créa"), "Site vitrine — Maro Créa");
    assert.equal(formatQuoteHit("DEV-2026-001", "Maro Créa"), "DEV-2026-001 — Maro Créa");
    assert.deepEqual(searchNeedles("@maro.crea"), ["@maro.crea", "maro.crea"]);
  });

  it("ignore une réponse périmée et signale vide, erreur ou session", () => {
    assert.equal(isCurrentSearch(2, 2), true);
    assert.equal(isCurrentSearch(1, 2), false);
    assert.equal(emptySearchResults("maro").status, "empty");
    assert.equal(emptySearchResults("maro", "error").status, "error");
    assert.equal(emptySearchResults("maro", "unauthenticated").status, "unauthenticated");
    assert.equal(groupSearchHits("maro", []).total, 0);
    assert.equal(groupSearchHits("maro", []).status, "ok");
  });

  it("navigue au clavier et ferme d'abord l'écran secondaire", () => {
    assert.equal(movePaletteIndex(0, "ArrowDown", 3), 1);
    assert.equal(movePaletteIndex(0, "ArrowUp", 3), 2);
    assert.equal(screenAfterEscape("search").close, true);
    assert.equal(screenAfterEscape("interaction").close, false);
    assert.equal(screenAfterEscape("follow-up").screen, "search");
    assert.equal(EMPTY_PALETTE_COMMANDS.some((command) => command.action.type === "create-prospect"), true);
    assert.equal(SEARCH_LIMIT_PER_KIND, 6);
  });

  it("n'offre pas Gagné ou Perdu depuis la palette", () => {
    const stages = openStageCommands("opp_1").map((command) =>
      command.action.type === "set-stage" ? command.action.stage : "",
    );
    assert.equal(stages.includes("WON"), false);
    assert.equal(stages.includes("LOST"), false);
    assert.equal(stages.includes("QUOTE"), true);
    const company = contextualCommands({
      id: "co_1",
      kind: "company",
      title: "Maro Créa",
      subtitle: "",
      href: "/entreprises/co_1",
      companyId: "co_1",
    });
    assert.deepEqual(
      company.map((command) => command.action.type),
      ["navigate", "interaction", "follow-up"],
    );
  });

  it("réutilise la recherche, le prospect, l'interaction et la relance existants", () => {
    const root = process.cwd();
    const palette = readFileSync(path.join(root, "src/components/layout/global-search.tsx"), "utf8");
    const query = readFileSync(path.join(root, "src/lib/queries/search.ts"), "utf8");
    const action = readFileSync(path.join(root, "src/actions/search.ts"), "utf8");
    assert.match(palette, /CreateProspectDialog/);
    assert.match(palette, /QuickInteractionPanel/);
    assert.match(palette, /createFollowUp/);
    assert.match(palette, /updateOpportunityStage/);
    assert.match(palette, /searchGlobal/);
    assert.equal(palette.includes('stage: "WON"'), false);
    assert.equal(palette.includes('stage: "LOST"'), false);
    assert.match(query, /instagram: contains/);
    assert.match(query, /phone: contains/);
    assert.match(query, /email: contains/);
    assert.match(query, /reference: contains/);
    assert.match(query, /SEARCH_LIMIT_PER_KIND/);
    assert.match(action, /unauthenticated/);
    assert.match(action, /"error"/);
  });
});
