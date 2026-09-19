import "server-only";

import { createHash } from "node:crypto";

/**
 * Deterministic JSON for argsHash. Key order is sorted; `undefined` keys are dropped.
 * The JWT signature already covers `args`; the hash is a second integrity check.
 */
export function canonicalizeJsonValue(value: unknown): unknown {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalizeJsonValue);
  }
  if (value && typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return {};
    }
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      const entry = record[key];
      if (entry === undefined) {
        continue;
      }
      out[key] = canonicalizeJsonValue(entry);
    }
    return out;
  }
  return null;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalizeJsonValue(value));
}

export function hashCanonicalArgs(args: unknown): string {
  return createHash("sha256").update(stableStringify(args)).digest("hex");
}

export function argsMatchSignedPayload(left: unknown, right: unknown): boolean {
  return stableStringify(left) === stableStringify(right);
}
