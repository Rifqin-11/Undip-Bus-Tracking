/**
 * Push worker endpoint for nearby-buggy alerts.
 *
 * Intended for a cron or worker call protected by PUSH_WORKER_TOKEN/CRON_SECRET.
 * It evaluates saved subscriptions against the latest live fleet snapshot.
 */
import { NextRequest, NextResponse } from "next/server";
import { processNearbyPushAlerts } from "@/lib/push/nearby-alerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const expectedToken =
    process.env.PUSH_WORKER_TOKEN?.trim() ?? process.env.CRON_SECRET?.trim();
  if (!expectedToken) return false;

  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${expectedToken}`;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await processNearbyPushAlerts();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal memproses push.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = POST;
