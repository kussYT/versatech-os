export const TERRAIN_PROSPECT_IMPORT_FLAG = "ALLOW_TERRAIN_PROSPECT_IMPORT";

export type TerrainImportEnv = NodeJS.Dict<string | undefined>;

function flagIsTrue(env: TerrainImportEnv) {
  return env[TERRAIN_PROSPECT_IMPORT_FLAG]?.trim().toLowerCase() === "true";
}

export function isTerrainProspectImportAllowed(env: TerrainImportEnv = process.env): boolean {
  if (env.NODE_ENV === "production") {
    return flagIsTrue(env);
  }

  return true;
}

export function assertTerrainProspectImportAllowed(env: TerrainImportEnv = process.env): void {
  if (isTerrainProspectImportAllowed(env)) {
    return;
  }

  throw new Error(
    `Refusing terrain prospect import in production. Set ${TERRAIN_PROSPECT_IMPORT_FLAG}=true only for this additive, idempotent import. Never use ALLOW_DESTRUCTIVE_SEED. ALEX'CEPTION remains protected.`,
  );
}
