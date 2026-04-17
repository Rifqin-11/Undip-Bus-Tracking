import { NextResponse } from "next/server";
import { createGeofence, readGeofences } from "@/lib/geofence-store";

export const runtime = "nodejs";

export async function GET() {
  const geofences = await readGeofences();
  return NextResponse.json(geofences);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Payload JSON tidak valid." },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { message: "Payload harus berupa object." },
      { status: 400 },
    );
  }

  const payload = body as {
    name?: unknown;
    center?: { lat?: unknown; lng?: unknown };
    radiusMeters?: unknown;
  };

  try {
    const geofence = await createGeofence({
      name: typeof payload.name === "string" ? payload.name : "",
      center: {
        lat: typeof payload.center?.lat === "number" ? payload.center.lat : NaN,
        lng: typeof payload.center?.lng === "number" ? payload.center.lng : NaN,
      },
      radiusMeters:
        typeof payload.radiusMeters === "number" ? payload.radiusMeters : NaN,
    });

    return NextResponse.json(geofence, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Gagal membuat geofence.",
      },
      { status: 400 },
    );
  }
}
