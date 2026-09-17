export type HealthStatus = "ok" | "unavailable";

export type HealthPayload = {
  status: HealthStatus;
};

export function healthPayload(ok: boolean): HealthPayload {
  return { status: ok ? "ok" : "unavailable" };
}

export function healthHttpStatus(ok: boolean) {
  return ok ? 200 : 503;
}
