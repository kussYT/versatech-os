import "server-only";

import { randomUUID } from "node:crypto";
import { formatServerError } from "@/lib/observability/log-error-format";

export function logServerError(context: string, error: unknown) {
  const id = randomUUID();
  console.error(`[${context}] id=${id} ${formatServerError(error)}`);
  return id;
}
