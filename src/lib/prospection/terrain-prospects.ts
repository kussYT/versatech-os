import { fromParisDateTime } from "@/lib/dates";
import { serializeCommercialBrief, type CommercialBrief } from "@/lib/prospection/brief";

export const TERRAIN_PROSPECT_SOURCE = "Prospection terrain";

export type ParsedTerrainAddress = {
  address: string | null;
  postalCode: string | null;
  city: string | null;
};

export type TerrainProspectVisit = {
  year: number;
  month: number;
  day: number;
  label: string;
};

export type TerrainProspectDraft = {
  name: string;
  industry: string;
  streetAddress?: string;
  city?: string;
  phone?: string;
  website?: string;
  visit: TerrainProspectVisit;
  brief: CommercialBrief;
};

/** Split "street, 59300 Valenciennes". Does not invent a street or postcode. */
export function parseTerrainStreetAddress(raw: string | undefined): ParsedTerrainAddress {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) {
    return { address: null, postalCode: null, city: null };
  }

  const match = trimmed.match(/^(.*?),\s*(\d{5})\s+(.+)$/);
  if (!match) {
    return { address: trimmed, postalCode: null, city: null };
  }

  return {
    address: match[1].trim() || null,
    postalCode: match[2],
    city: match[3].trim() || null,
  };
}

export function terrainProspectRecord(draft: TerrainProspectDraft) {
  const parsed = parseTerrainStreetAddress(draft.streetAddress);
  return {
    name: draft.name,
    industry: draft.industry,
    address: parsed.address,
    postalCode: parsed.postalCode,
    city: parsed.city ?? draft.city?.trim() ?? null,
    phone: draft.phone?.trim() ?? null,
    website: draft.website?.trim() ?? null,
    source: TERRAIN_PROSPECT_SOURCE,
    country: "FR",
    lifecycleStatus: "LEAD" as const,
    commercialBrief: serializeCommercialBrief(draft.brief),
    tourDate: fromParisDateTime(draft.visit.year, draft.visit.month, draft.visit.day, 0, 0, 0, 0),
    visitLabel: draft.visit.label,
  };
}

function visitNote(label: string) {
  return `Passage terrain prévu le ${label}.`;
}

export const TERRAIN_PROSPECTS: readonly TerrainProspectDraft[] = [
  {
    name: "Artisan Mickael couvreur",
    industry: "Couverture / toiture",
    streetAddress: "31 Rue Grégoire Nicolas Finez, 59300 Valenciennes",
    phone: "07 61 02 43 33",
    visit: { year: 2026, month: 9, day: 21, label: "lundi 21/09/2026" },
    brief: {
      digitalPresence:
        "Présence web non vérifiée. Ne pas affirmer l'absence de site sans vérification supplémentaire.",
      strengths: "Entreprise locale de couverture.",
      opportunities: visitNote("lundi 21/09/2026"),
      proposal:
        "Mettre en avant les réalisations et les prestations. Faciliter les demandes de contact et de devis.",
      angle: "Acquisition locale.",
      verificationStatus: "UNVERIFIED",
    },
  },
  {
    name: "HL BEAUTY",
    industry: "Institut de beauté",
    streetAddress: "48 Avenue Villars, 59300 Valenciennes",
    visit: { year: 2026, month: 9, day: 22, label: "mardi 22/09/2026" },
    brief: {
      digitalPresence: "Présence importante via Planity.",
      strengths: "",
      opportunities: `${visitNote("mardi 22/09/2026")} Conserver éventuellement Planity comme système de réservation.`,
      proposal:
        "Valoriser les prestations, la galerie, l'univers visuel et le référencement local.",
      angle: "Développer une vitrine propriétaire et l'identité de marque.",
      verificationStatus: "PARTIAL",
    },
  },
  {
    name: "L'Instant Gourmand",
    industry: "Restaurant",
    city: "Valenciennes",
    visit: { year: 2026, month: 9, day: 23, label: "mercredi 23/09/2026" },
    brief: {
      digitalPresence:
        "Présence web actuelle via Eatbu. Prospect de refonte, pas « sans site ».",
      strengths: "Carte qui évolue régulièrement.",
      opportunities: visitNote("mercredi 23/09/2026"),
      proposal:
        "Valorisation des plats, des photos et de la carte. Approche similaire au savoir-faire restaurant développé pour ALEX'CEPTION.",
      angle: "Site propriétaire premium.",
      verificationStatus: "PARTIAL",
    },
  },
  {
    name: "Sébastien Marin Artisan Ebéniste",
    industry: "Ébénisterie / restauration de meubles et objets d'art",
    streetAddress: "50 Rue de la Citadelle, 59300 Valenciennes",
    phone: "06 01 38 03 46",
    website: "https://ateliermarin-ebenisterie-restauration.fr/",
    visit: { year: 2026, month: 9, day: 24, label: "jeudi 24/09/2026" },
    brief: {
      digitalPresence: "Possède déjà un site. Prospect de refonte.",
      strengths: "",
      opportunities: visitNote("jeudi 24/09/2026"),
      proposal:
        "Mettre en valeur le savoir-faire artisanal, les restaurations et réalisations. Forte importance des photos avant/après.",
      angle: "Portfolio haut de gamme.",
      verificationStatus: "PARTIAL",
    },
  },
  {
    name: "Premium auto",
    industry: "Garage automobile",
    streetAddress: "234 Avenue de Denain, 59300 Valenciennes",
    phone: "07 67 42 94 49",
    visit: { year: 2026, month: 9, day: 25, label: "vendredi 25/09/2026" },
    brief: {
      digitalPresence:
        "État actuel du site internet non renseigné — ne pas l'inventer.",
      strengths: "",
      opportunities: visitNote("vendredi 25/09/2026"),
      proposal:
        "Présenter clairement les prestations et services. Réassurance. Demandes de contact et de devis.",
      angle: "Visibilité locale.",
      verificationStatus: "UNVERIFIED",
    },
  },
];

export function terrainProspectNames() {
  return TERRAIN_PROSPECTS.map((prospect) => prospect.name);
}
