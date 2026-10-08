import { createHmac, timingSafeEqual } from "node:crypto";

export const SENSITIVE_CONFIRMATION_TTL_MS = 10 * 60 * 1000;

type OpportunityStageConfirmation = {
  kind: "opportunity-stage";
  actorId: string;
  opportunityId: string;
  stage: "WON" | "LOST";
  lostReason: string | null;
};

type CompanyLifecycleConfirmation = {
  kind: "company-lifecycle";
  actorId: string;
  companyId: string;
  lifecycle: "CLIENT" | "LOST";
};

export type SensitiveConfirmation = OpportunityStageConfirmation | CompanyLifecycleConfirmation;

export type SensitiveIntent = SensitiveConfirmation & { exp: number };

export function signSensitiveIntent(intent: SensitiveIntent, secret: string): string {
  const body = Buffer.from(JSON.stringify(intent)).toString("base64url");
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifySensitiveIntent(
  token: string | null | undefined,
  expected: SensitiveConfirmation,
  secret: string,
  now = new Date(),
): boolean {
  if (!token || !secret) {
    return false;
  }
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return false;
  }
  const expectedSignature = createHmac("sha256", secret).update(parts[0]).digest("base64url");
  const left = Buffer.from(parts[1]);
  const right = Buffer.from(expectedSignature);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return false;
  }

  let parsed: SensitiveIntent;
  try {
    parsed = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")) as SensitiveIntent;
  } catch {
    return false;
  }

  if (parsed.actorId !== expected.actorId) {
    return false;
  }
  if (!Number.isFinite(parsed.exp) || parsed.exp < now.getTime()) {
    return false;
  }

  switch (expected.kind) {
    case "opportunity-stage":
      return (
        parsed.kind === "opportunity-stage" &&
        parsed.opportunityId === expected.opportunityId &&
        parsed.stage === expected.stage &&
        parsed.lostReason === expected.lostReason
      );
    case "company-lifecycle":
      return (
        parsed.kind === "company-lifecycle" &&
        parsed.companyId === expected.companyId &&
        parsed.lifecycle === expected.lifecycle
      );
    default:
      return false;
  }
}
