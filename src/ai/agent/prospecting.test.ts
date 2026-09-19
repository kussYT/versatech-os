import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  PROSPECTING_CRM_TOOL,
  PROSPECTING_GUIDANCE,
  PROSPECTING_LIMITS,
  PROSPECTING_WEB_TOOL,
  PROSPECTING_WEBSITE_ABSENT,
  PROSPECTING_WEBSITE_REDESIGN,
  PROSPECTING_WEBSITE_THIRD_PARTY,
} from "@/ai/agent/prospecting";

describe("prospection mixte Web + CRM", () => {
  test("uses webSearch then searchCompanies and never auto-creates a Company", () => {
    assert.equal(PROSPECTING_WEB_TOOL, "webSearch");
    assert.equal(PROSPECTING_CRM_TOOL, "searchCompanies");
    assert.match(PROSPECTING_GUIDANCE, /webSearch/);
    assert.match(PROSPECTING_GUIDANCE, /searchCompanies/);
    assert.match(PROSPECTING_GUIDANCE, /puis searchCompanies/);
    assert.match(PROSPECTING_GUIDANCE, /Jamais créer une Company/);
    assert.match(PROSPECTING_GUIDANCE, /createCompany/);
    assert.equal(PROSPECTING_LIMITS.autoCreateCompany, false);
    assert.equal(PROSPECTING_LIMITS.secondWebSearchTool, false);
    assert.doesNotMatch(PROSPECTING_GUIDANCE, /SearXNG/);
    assert.doesNotMatch(PROSPECTING_GUIDANCE, /scrape|webview/i);
  });

  test("forbids invented contact fields and a fake numeric score", () => {
    assert.match(PROSPECTING_GUIDANCE, /Ne jamais inventer téléphone, adresse ou site/);
    assert.match(PROSPECTING_GUIDANCE, /Aucun score numérique inventé/);
    assert.match(PROSPECTING_GUIDANCE, /faits observés/);
    assert.match(PROSPECTING_GUIDANCE, /angle VersaTech/);
    assert.equal(PROSPECTING_LIMITS.inventPhone, false);
    assert.equal(PROSPECTING_LIMITS.inventAddress, false);
    assert.equal(PROSPECTING_LIMITS.inventWebsite, false);
    assert.equal(PROSPECTING_LIMITS.fakeNumericScore, false);
  });

  test("website qualification does not claim « pas de site » from one miss", () => {
    assert.equal(PROSPECTING_LIMITS.claimNoWebsiteFromOneMiss, false);
    assert.match(PROSPECTING_GUIDANCE, new RegExp(PROSPECTING_WEBSITE_ABSENT));
    assert.match(PROSPECTING_GUIDANCE, new RegExp(PROSPECTING_WEBSITE_THIRD_PARTY));
    assert.match(PROSPECTING_GUIDANCE, new RegExp(PROSPECTING_WEBSITE_REDESIGN));
    assert.match(PROSPECTING_GUIDANCE, /Un hit Web manquant/);
    assert.doesNotMatch(PROSPECTING_GUIDANCE, /il n'y a pas de site/);
  });
});
