/**
 * Business-service result — not UI `ActionResult`, not tool `ToolResult`.
 * Services never redirect and never see FormData.
 */
import { flattenError, type ZodError } from "zod";
import type { ActionResult } from "@/lib/crm/action-result";

export type ServiceFieldErrors = Record<string, string[] | undefined>;

export const SERVICE_ERROR_CODES = [
  "AUTH_REQUIRED",
  "NOT_FOUND",
  "VALIDATION",
  "CONFLICT",
  "FORBIDDEN",
  "DEPENDENCY",
] as const;

export type ServiceErrorCode = (typeof SERVICE_ERROR_CODES)[number];

export type ServiceResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: ServiceErrorCode;
      message: string;
      fieldErrors?: ServiceFieldErrors;
    };

export function serviceOk<T>(data: T): ServiceResult<T> {
  return { ok: true, data };
}

export function serviceFail(
  code: ServiceErrorCode,
  message: string,
  fieldErrors?: ServiceFieldErrors,
): ServiceResult<never> {
  return fieldErrors
    ? { ok: false, code, message, fieldErrors }
    : { ok: false, code, message };
}

export function fieldErrorsFromZod(error: ZodError): ServiceFieldErrors {
  return flattenError(error).fieldErrors;
}

/** Server Action adapter: map a service result without touching Prisma / revalidate. */
export function toActionResult<T extends NonNullable<ActionResult["data"]>>(
  result: ServiceResult<T>,
): ActionResult {
  if (result.ok) {
    return { ok: true, data: result.data };
  }
  return {
    ok: false,
    message: result.message,
    fieldErrors: result.fieldErrors,
  };
}

export type ActivitySource = "ai";

export function withActivitySource<T extends Record<string, string | number | boolean | null>>(
  metadata: T,
  source?: ActivitySource,
): T | (T & { source: "ai" }) {
  if (source === "ai") {
    return { ...metadata, source: "ai" };
  }
  return metadata;
}
