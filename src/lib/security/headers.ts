export const PATHNAME_HEADER = "x-vt-pathname";

export function createRequestNonce() {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

export function contentSecurityPolicy(nonce: string, isDev = process.env.NODE_ENV === "development") {
  const scriptSrc = isDev
    ? `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`;

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https://tile.openstreetmap.org https://*.tile.openstreetmap.org",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
  ]
    .join("; ")
    .replace(/\s+/g, " ")
    .trim();
}

export function applicationSecurityHeaders(nonce: string, isDev = process.env.NODE_ENV === "development") {
  return {
    "Content-Security-Policy": contentSecurityPolicy(nonce, isDev),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  } as const;
}

export function applyApplicationSecurityHeaders(headers: Headers, nonce: string) {
  const values = applicationSecurityHeaders(nonce);
  for (const [key, value] of Object.entries(values)) {
    headers.set(key, value);
  }
}
