import { NextRequest, NextResponse } from "next/server";
import { ingestBuggyPayload } from "@/lib/realtime/buggy-live-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/gps-beacon
 *
 * Receives real GPS data from iPhone and injects it directly
 * into the live buggy store.
 *
 * Body: { buggyId, lat, lng, accuracy?, speedKmh?, heading?, altitude? }
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as Record<string, unknown>).lat !== "number" ||
    typeof (body as Record<string, unknown>).lng !== "number"
  ) {
    return NextResponse.json(
      { error: "Missing required fields: lat, lng" },
      { status: 400 },
    );
  }

  const {
    buggyId = 2,
    lat,
    lng,
    accuracy,
    speedKmh = 0,
    heading,
    altitude,
  } = body as Record<string, unknown>;

  const numericBuggyId = Number(buggyId);

  const telemetryPayload = {
    telemetry: [
      {
        id: numericBuggyId,
        lat: Number(lat),
        lng: Number(lng),
        speedKmh: typeof speedKmh === "number" ? speedKmh : 0,
        accuracy: typeof accuracy === "number" ? accuracy : undefined,
        heading: typeof heading === "number" ? heading : undefined,
        altitude: typeof altitude === "number" ? altitude : undefined,
        tag: "iphone_gps",
        timestamp: new Date().toISOString(),
      },
    ],
  };

  const result = ingestBuggyPayload(telemetryPayload);

  if (!result) {
    return NextResponse.json(
      { error: `Buggy ID ${numericBuggyId} not found in store` },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    accepted: result.accepted,
    buggyId: numericBuggyId,
    position: { lat: Number(lat), lng: Number(lng) },
    updatedAt: result.updatedAt,
  });
}

/** GET /api/gps-beacon — health check */
export async function GET() {
  return NextResponse.json({ ok: true, message: "GPS Beacon API is running" });
}
