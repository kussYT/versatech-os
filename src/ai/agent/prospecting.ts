import "server-only";

/**
 * Compact prospection guidance for the Mastra agent (Wave 7).
 * Agent B imports `PROSPECTING_GUIDANCE` into instructions.
 *
 * One web tool only: `webSearch`. CRM lookup stays `searchCompanies`.
 * Never auto-create a Company, never scrape, never invent contact fields.
 */

export const PROSPECTING_WEB_TOOL = "webSearch" as const;
export const PROSPECTING_CRM_TOOL = "searchCompanies" as const;

export const PROSPECTING_WEBSITE_ABSENT =
  "aucun site propriétaire identifié dans les résultats consultés";
export const PROSPECTING_WEBSITE_THIRD_PARTY = "présence plateforme tierce";
export const PROSPECTING_WEBSITE_REDESIGN =
  "site identifié mais refonte potentiellement pertinente";

/** Qualification limits — coded here as text B must keep; no new WRITE tool. */
export const PROSPECTING_LIMITS = {
  autoCreateCompany: false,
  inventPhone: false,
  inventAddress: false,
  inventWebsite: false,
  fakeNumericScore: false,
  secondWebSearchTool: false,
  claimNoWebsiteFromOneMiss: false,
} as const;

export const PROSPECTING_GUIDANCE = `Prospection mixte Web + CRM (un seul outil Web : webSearch).
1) webSearch pour la présence publique, puis searchCompanies pour le CRM. Comparer : déjà en fiche vs seulement en ligne. Jamais créer une Company, jamais proposer createCompany, jamais écrire une fiche depuis le Web.
2) Ne jamais inventer téléphone, adresse ou site. Citer seulement ce que webSearch ou le CRM a renvoyé.
3) Un hit Web manquant ≠ « pas de site ». Formulations autorisées uniquement : « ${PROSPECTING_WEBSITE_ABSENT} » ; « ${PROSPECTING_WEBSITE_THIRD_PARTY} » ; « ${PROSPECTING_WEBSITE_REDESIGN} ».
4) Signaux commerciaux = faits observés + opportunité potentielle + angle VersaTech. Aucun score numérique inventé.
5) 0 ou plusieurs fiches CRM → demander une précision, ne pas choisir, ne pas créer. Le Web n'est pas le CRM.`;
