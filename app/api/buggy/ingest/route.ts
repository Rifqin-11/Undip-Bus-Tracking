import { NextRequest, NextResponse } from "next/server";
import { requireIngestToken } from "@/lib/auth/ingest-token";
import { ingestBuggyPayload } from "@/lib/realtime/buggy-live-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const tokenError = requireIngestToken(request);
  if (tokenError) return tokenError;

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
