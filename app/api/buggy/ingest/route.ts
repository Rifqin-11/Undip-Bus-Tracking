import { NextRequest, NextResponse } from "next/server";
import { ingestBuggyPayload } from "@/lib/realtime/buggy-live-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  const requiredToken = process.env.BUGGY_INGEST_TOKEN;
  if (!requiredToken) return true;
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${requiredToken}`;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized ingest request." },
      { status: 401 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Invalid JSON body. Use Buggy[] snapshot or { telemetry: [{ id, lat, lng, ... }] }.",
      },
      { status: 400 },
    );
  }

  const result = ingestBuggyPayload(payload);
  if (!result) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Payload not recognized. Provide Buggy[] snapshot or telemetry array with id/lat/lng.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    ...result,
  });
}
