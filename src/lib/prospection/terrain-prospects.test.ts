import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { fromParisDateTime, parisDateKey } from "@/lib/dates";
import { addCompanyToStops } from "@/lib/prospection/tour";
import {
  TERRAIN_PROSPECTS,
  TERRAIN_PROSPECT_SOURCE,
  parseTerrainStreetAddress,
  terrainProspectNames,
  terrainProspectRecord,
} from "./terrain-prospects";

describe("import prospects terrain Valenciennes", () => {
  test("lists five unique LEAD drafts with the terrain source", () => {
    assert.equal(TERRAIN_PROSPECTS.length, 5);
    const names = terrainProspectNames();
    assert.equal(new Set(names).size, 5);
    assert.equal(names.includes("ALEX'CEPTION"), false);

    for (const draft of TERRAIN_PROSPECTS) {
      const record = terrainProspectRecord(draft);
      assert.equal(record.lifecycleStatus, "LEAD");
      assert.equal(record.source, TERRAIN_PROSPECT_SOURCE);
      assert.equal(record.country, "FR");
      assert.equal(record.city, "Valenciennes");
    }
  });

  test("parses provided street addresses without inventing a street", () => {
    assert.deepEqual(
      parseTerrainStreetAddress("31 Rue Grégoire Nicolas Finez, 59300 Valenciennes"),
      {
        address: "31 Rue Grégoire Nicolas Finez",
        postalCode: "59300",
        city: "Valenciennes",
      },
    );
    assert.deepEqual(parseTerrainStreetAddress(undefined), {
      address: null,
      postalCode: null,
      city: null,
    });

    const restaurant = terrainProspectRecord(
      TERRAIN_PROSPECTS.find((prospect) => prospect.name === "L'Instant Gourmand")!,
    );
    assert.equal(restaurant.address, null);
    assert.equal(restaurant.postalCode, null);
    assert.equal(restaurant.city, "Valenciennes");
    assert.equal(restaurant.phone, null);
    assert.equal(restaurant.website, null);
  });

  test("keeps provided website and phones, and does not claim missing sites", () => {
    const marin = terrainProspectRecord(
      TERRAIN_PROSPECTS.find((prospect) => prospect.name === "Sébastien Marin Artisan Ebéniste")!,
    );
    assert.equal(marin.website, "https://ateliermarin-ebenisterie-restauration.fr/");
    assert.equal(marin.phone, "06 01 38 03 46");
    assert.match(marin.commercialBrief.digitalPresence, /Possède déjà un site/);

    const mickael = terrainProspectRecord(
      TERRAIN_PROSPECTS.find((prospect) => prospect.name === "Artisan Mickael couvreur")!,
    );
    assert.equal(mickael.phone, "07 61 02 43 33");
    assert.equal(mickael.website, null);
    assert.match(mickael.commercialBrief.digitalPresence, /non vérifiée/);
    assert.doesNotMatch(mickael.commercialBrief.digitalPresence, /aucun site/i);

    const premium = terrainProspectRecord(
      TERRAIN_PROSPECTS.find((prospect) => prospect.name === "Premium auto")!,
    );
    assert.equal(premium.phone, "07 67 42 94 49");
    assert.equal(premium.website, null);
    assert.match(premium.commercialBrief.digitalPresence, /ne pas l'inventer/);

    const restaurant = terrainProspectRecord(
      TERRAIN_PROSPECTS.find((prospect) => prospect.name === "L'Instant Gourmand")!,
    );
    assert.match(restaurant.commercialBrief.digitalPresence, /Eatbu/);
    assert.match(restaurant.commercialBrief.digitalPresence, /refonte/);
    assert.match(restaurant.commercialBrief.digitalPresence, /pas « sans site »/);
  });

  test("maps each prospect to a unique Europe/Paris tour day in order 1", () => {
    const keys = TERRAIN_PROSPECTS.map((draft) =>
      parisDateKey(terrainProspectRecord(draft).tourDate),
    );
    assert.deepEqual(keys, [
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
      "2026-09-24",
      "2026-09-25",
    ]);
    assert.equal(
      terrainProspectRecord(TERRAIN_PROSPECTS[0]!).tourDate.toISOString(),
      fromParisDateTime(2026, 9, 21, 0, 0, 0, 0).toISOString(),
    );

    let stops = addCompanyToStops([], "company-a");
    stops = addCompanyToStops(stops, "company-a");
    assert.deepEqual(stops, [{ companyId: "company-a", order: 1, visitedAt: null }]);
  });
});
