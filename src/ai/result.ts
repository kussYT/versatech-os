import "server-only";

/**
 * Tool I/O result — distinct from UI `ActionResult`.
 * `success === true` ⇒ `data` is set and `error` is absent.
 * `success === false` ⇒ `error` is set and no business `data`.
 * Messages are operator-safe: never stacks, SQL, or secrets.
 */
export const TOOL_ERROR_CODES = [
  "AUTH_REQUIRED",
  "VALIDATION_FAILED",
  "NOT_FOUND",
  "RANGE_TOO_LARGE",
  "FORBIDDEN",
  "CONFIRMATION_REQUIRED",
  "INTERNAL",
  "NOT_AVAILABLE",
  "SERVICE_UNAVAILABLE",
  "NOT_IMPLEMENTED",
] as const;

export type ToolErrorCode = (typeof TOOL_ERROR_CODES)[number];

export type ToolError = {
  code: ToolErrorCode;
  message: string;
};

export type ToolResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: ToolError };

export const TOOL_ERROR_MESSAGES: Record<ToolErrorCode, string> = {
  AUTH_REQUIRED: "Authentification requise.",
  VALIDATION_FAILED: "Paramètres invalides.",
  NOT_FOUND: "Ressource introuvable.",
  RANGE_TOO_LARGE: "La plage demandée est trop large.",
  FORBIDDEN: "Outil interdit.",
  CONFIRMATION_REQUIRED: "Confirmation serveur requise.",
  INTERNAL: "Une erreur interne est survenue.",
  NOT_AVAILABLE: "Cet outil n'est pas disponible.",
  SERVICE_UNAVAILABLE: "Service métier indisponible.",
  NOT_IMPLEMENTED: "Cet outil n'est pas encore disponible.",
};

const SECRETISH_RE =
  /(password|secret|token|authorization|api[_-]?key|database_url|postgres(ql)?:\/\/|bearer\s+)/i;

export function isSafeToolMessage(message: string): boolean {
  if (message.includes("\n") || message.includes("\r") || message.includes("\t")) {
    return false;
  }
  if (message.length > 180) {
    return false;
  }
  return !SECRETISH_RE.test(message);
}

function safeMessage(code: ToolErrorCode, message?: string): string {
  if (message && isSafeToolMessage(message)) {
    return message;
  }
  return TOOL_ERROR_MESSAGES[code];
}

export function toolSuccess<T>(data: T): ToolResult<T> {
  return { success: true, data };
}

export function toolFailure(code: ToolErrorCode, message?: string): ToolResult<never> {
  return {
    success: false,
    error: {
      code,
      message: safeMessage(code, message),
    },
  };
}
