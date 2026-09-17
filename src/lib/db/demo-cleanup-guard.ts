export const DEMO_CLEANUP_FLAG = "ALLOW_DEMO_CLEANUP";

/** Real client — never included in a cleanup allowlist. */
export const PROTECTED_COMPANY_ID = "cmu5gwo610000vwum30m6q88p";

/** Real VersaTech admin — never deleted. */
export const PROTECTED_USER_ID = "cmu4bkfdt0000vgumntadsoss";

/**
 * Explicit demo / E2E company IDs audited on 2026-09-17.
 * Cleanup never matches on company name.
 */
export const DEMO_COMPANY_IDS = [
  "cmu4bkfek0001vgumx41rpqzo", // Atelier Horizon (seed)
  "cmu4bkffl000dvgumrc6g0z91", // Maison Rivage (seed)
  "cmu4bkfgv000svgum6gyvy1wv", // Studio Nova (seed)
  "cmu4hxkic0000lkum8ewua0u9", // Atelier Integration OS
  "cmu4lv3630000n8umqoz2pf8u", // Prospect Terrain Test
  "cmu5byr3b0000ocum9jixzm16", // E2E VERSATECH TEST
] as const;

export type DemoCleanupEnv = NodeJS.Dict<string | undefined>;

export function isDemoCleanupExecuteAllowed(env: DemoCleanupEnv = process.env): boolean {
  if (env.NODE_ENV === "production") {
    return false;
  }

  return env[DEMO_CLEANUP_FLAG]?.trim().toLowerCase() === "true";
}

export function assertDemoCleanupNotProduction(env: DemoCleanupEnv = process.env): void {
  if (env.NODE_ENV === "production") {
    throw new Error(
      "Refusing demo cleanup in production, including dry-run. This script is for the local VersaTech OS database only.",
    );
  }
}

export function assertDemoCleanupExecuteAllowed(env: DemoCleanupEnv = process.env): void {
  assertDemoCleanupNotProduction(env);

  if (!isDemoCleanupExecuteAllowed(env)) {
    throw new Error(
      `Refusing to delete demo rows. Dry-run is the default. Set ${DEMO_CLEANUP_FLAG}=true only after reviewing the company ID allowlist. Never enable it against ALEX'CEPTION.`,
    );
  }
}

export function assertNotProtectedCompany(
  companyId: string,
  protectedCompanyId = PROTECTED_COMPANY_ID,
): void {
  if (companyId === protectedCompanyId) {
    throw new Error(
      `Refusing to cleanup protected company ${protectedCompanyId} (ALEX'CEPTION).`,
    );
  }
}

export function assertNotProtectedUser(
  userId: string,
  protectedUserId = PROTECTED_USER_ID,
): void {
  if (userId === protectedUserId) {
    throw new Error(`Refusing to delete protected admin user ${protectedUserId}.`);
  }
}

export function assertCompanyIdInAllowlist(
  companyId: string,
  allowlist: readonly string[] = DEMO_COMPANY_IDS,
): void {
  assertNotProtectedCompany(companyId);
  if (!allowlist.includes(companyId)) {
    throw new Error(
      `Company ${companyId} is not in the explicit demo cleanup allowlist.`,
    );
  }
}

export function validateDemoCleanupAllowlist(
  allowlist: readonly string[] = DEMO_COMPANY_IDS,
  protectedCompanyId = PROTECTED_COMPANY_ID,
  protectedUserId = PROTECTED_USER_ID,
): string[] {
  if (allowlist.length === 0) {
    throw new Error("Demo cleanup allowlist is empty.");
  }

  const unique = new Set<string>();
  for (const id of allowlist) {
    if (!id || id.trim() !== id || id.length < 8) {
      throw new Error("Demo cleanup allowlist contains an invalid id.");
    }
    assertNotProtectedCompany(id, protectedCompanyId);
    assertNotProtectedUser(id, protectedUserId);
    if (unique.has(id)) {
      throw new Error(`Demo cleanup allowlist contains a duplicate id: ${id}`);
    }
    unique.add(id);
  }

  return [...unique];
}
