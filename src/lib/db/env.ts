const ILLUSTRATIVE_DATABASE_URL =
  "postgresql://USER:PASSWORD@HOST:5432/versatech_os";

const POSTGRES_URL_PATTERN = /^postgres(ql)?:\/\//i;

export function isIllustrativeDatabaseUrl(url: string): boolean {
  return url.trim() === ILLUSTRATIVE_DATABASE_URL;
}

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();

  if (!url) {
    throw new Error(
      "DATABASE_URL is missing. Copy .env.example to .env and set a real PostgreSQL connection string.",
    );
  }

  if (!POSTGRES_URL_PATTERN.test(url)) {
    throw new Error(
      "DATABASE_URL must be a PostgreSQL connection string (postgresql:// or postgres://).",
    );
  }

  if (isIllustrativeDatabaseUrl(url)) {
    throw new Error(
      "DATABASE_URL still uses the illustrative .env.example value. Point it at a real PostgreSQL instance.",
    );
  }

  return url;
}
