const UNIQUE_CODES = new Set(["P2002", "23505"]);

/**
 * True for Prisma P2002 and PostgreSQL 23505, including adapter-wrapped causes.
 * Duck-typed so tests can mock without a live engine.
 */
export function isUniqueConstraintViolation(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;

  for (let depth = 0; depth < 6 && current && typeof current === "object"; depth += 1) {
    if (seen.has(current)) {
      return false;
    }
    seen.add(current);

    const record = current as Record<string, unknown>;
    if (isUniqueCode(record.code) || isUniqueCode(record.originalCode)) {
      return true;
    }
    if (record.kind === "UniqueConstraintViolation") {
      return true;
    }

    current = record.cause ?? record.error;
  }

  return false;
}

function isUniqueCode(code: unknown): boolean {
  return typeof code === "string" && UNIQUE_CODES.has(code);
}
