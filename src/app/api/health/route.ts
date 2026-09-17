import { NextResponse } from "next/server";
import { isDatabaseReachable } from "@/lib/health/check";
import { healthHttpStatus, healthPayload } from "@/lib/health/status";

export const dynamic = "force-dynamic";

export async function GET() {
  const ok = await isDatabaseReachable();
  return NextResponse.json(healthPayload(ok), { status: healthHttpStatus(ok) });
}
