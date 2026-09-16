export const BRIEF_VERIFICATION_STATUSES = ["UNVERIFIED", "PARTIAL", "VERIFIED"] as const;
export type BriefVerificationStatus = (typeof BRIEF_VERIFICATION_STATUSES)[number];

export const BRIEF_VERIFICATION_LABELS: Record<BriefVerificationStatus, string> = {
  UNVERIFIED: "Non vérifié",
  PARTIAL: "Partiel",
  VERIFIED: "Vérifié",
};

export type CommercialBrief = {
  digitalPresence: string;
  strengths: string;
  opportunities: string;
  proposal: string;
  angle: string;
  verificationStatus: BriefVerificationStatus;
};

export const EMPTY_COMMERCIAL_BRIEF: CommercialBrief = {
  digitalPresence: "",
  strengths: "",
  opportunities: "",
  proposal: "",
  angle: "",
  verificationStatus: "UNVERIFIED",
};

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asVerification(value: unknown): BriefVerificationStatus {
  if (value === "PARTIAL" || value === "VERIFIED" || value === "UNVERIFIED") {
    return value;
  }
  return "UNVERIFIED";
}

export function parseCommercialBrief(value: unknown): CommercialBrief {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...EMPTY_COMMERCIAL_BRIEF };
  }

  const record = value as Record<string, unknown>;
  return {
    digitalPresence: asString(record.digitalPresence),
    strengths: asString(record.strengths),
    opportunities: asString(record.opportunities),
    proposal: asString(record.proposal),
    angle: asString(record.angle),
    verificationStatus: asVerification(record.verificationStatus),
  };
}

export function serializeCommercialBrief(brief: CommercialBrief): CommercialBrief {
  return {
    digitalPresence: brief.digitalPresence.trim(),
    strengths: brief.strengths.trim(),
    opportunities: brief.opportunities.trim(),
    proposal: brief.proposal.trim(),
    angle: brief.angle.trim(),
    verificationStatus: asVerification(brief.verificationStatus),
  };
}

export function isBriefVerificationStatus(value: string): value is BriefVerificationStatus {
  return (BRIEF_VERIFICATION_STATUSES as readonly string[]).includes(value);
}
