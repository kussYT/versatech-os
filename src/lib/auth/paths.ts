import { DEFAULT_AFTER_LOGIN_PATH, LOGIN_PATH } from "@/lib/auth/config";

export function isPublicPath(pathname: string) {
  return pathname === LOGIN_PATH || pathname.startsWith(`${LOGIN_PATH}/`);
}

export function safeRedirectPath(value: string | null | undefined) {
  if (!value) {
    return DEFAULT_AFTER_LOGIN_PATH;
  }

  if (!value.startsWith("/") || value.startsWith("//") || value.includes("://")) {
    return DEFAULT_AFTER_LOGIN_PATH;
  }

  if (value.includes("\\") || value.includes("\n") || value.includes("\r")) {
    return DEFAULT_AFTER_LOGIN_PATH;
  }

  if (isPublicPath(value)) {
    return DEFAULT_AFTER_LOGIN_PATH;
  }

  return value;
}
