const DESTRUCTIVE_SEED_FLAG = "ALLOW_DESTRUCTIVE_SEED";

export function isDestructiveSeedAllowed(
  env: NodeJS.Dict<string | undefined> = process.env,
): boolean {
  if (env.NODE_ENV === "production") {
    return false;
  }

  return env[DESTRUCTIVE_SEED_FLAG]?.trim().toLowerCase() === "true";
}

export function assertDestructiveSeedAllowed(
  env: NodeJS.Dict<string | undefined> = process.env,
): void {
  if (env.NODE_ENV === "production") {
    throw new Error(
      "Refusing to run the development seed in production. This seed deletes all CRM data.",
    );
  }

  if (!isDestructiveSeedAllowed(env)) {
    throw new Error(
      `Refusing to run the destructive development seed. Set ${DESTRUCTIVE_SEED_FLAG}=true only on a disposable local database. Never enable it on a database that contains real clients such as ALEX'CEPTION.`,
    );
  }
}
