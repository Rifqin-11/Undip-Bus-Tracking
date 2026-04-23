import { NextRequest, NextResponse } from "next/server";
import { ingestBuggyPayload } from "@/lib/realtime/buggy-live-store";
import {
  createAdminClient,
  getBuggyHistoryTableName,
} from "@/lib/supabase/server";
import {
  startSession,
  addPoint,
  finalizeSession,
} from "@/lib/realtime/session-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Membatasi insert ke Supabase maksimal 1 kali setiap 10 detik per buggy
const HISTORY_INSERT_INTERVAL_MS = 10_000;
const lastHistoryInsertPerBuggy: Record<number, number> = {};

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

  // Allow sessionEnd requests without lat/lng
  const b = body as Record<string, unknown>;
  const isSessionEnd = b.sessionEnd === true;

  if (
    !isSessionEnd &&
    (typeof b.lat !== "number" || typeof b.lng !== "number")
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
    forceResync,
    batteryLevel,
    sessionStart,
    sessionEnd,
  } = b;

  const numericBuggyId = Number(buggyId);
  const buggyIdNormalized = `buggy-${numericBuggyId}`;

  // ── Session: handle end FIRST (no GPS data needed) ───────────────────────
  if (sessionEnd === true) {
    await finalizeSession(buggyIdNormalized);
    return NextResponse.json({ ok: true, sessionEnded: true, buggyId: numericBuggyId });
  }

  // ── Live store ingest ─────────────────────────────────────────────────────
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
        forceResync: forceResync === true,
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

  // Best effort persistence for admin trip history (do not block live ingest).
  const now = Date.now();
  const lastInsert = lastHistoryInsertPerBuggy[numericBuggyId] || 0;

  if (now - lastInsert >= HISTORY_INSERT_INTERVAL_MS) {
    // Segera perbarui timestamp agar request dalam 10 detik ke depan di-throttle
    lastHistoryInsertPerBuggy[numericBuggyId] = now;

    const supabase = createAdminClient();
    if (supabase) {
      const buggyIdNormalized = `buggy-${numericBuggyId}`;
      const tableName = getBuggyHistoryTableName();

      const { error } = await supabase.from(tableName).insert({
        buggy_id: buggyIdNormalized,
        buggy_numeric_id: numericBuggyId,
        lat: Number(lat),
        lng: Number(lng),
        accuracy: typeof accuracy === "number" ? accuracy : null,
        speed_kmh: typeof speedKmh === "number" ? speedKmh : 0,
        heading: typeof heading === "number" ? heading : null,
        altitude: typeof altitude === "number" ? altitude : null,
        battery_level:
          typeof batteryLevel === "number" &&
          batteryLevel >= 0 &&
          batteryLevel <= 100
            ? Math.round(batteryLevel)
            : null,
        source: "iphone_gps",
        recorded_at: new Date().toISOString(),
      });

      if (error) {
        console.warn("Supabase history insert failed:", error.message);
      }
    }
  }

  // ── Session store: start / accumulate ─────────────────────────────────────
  const recordedAt = new Date().toISOString();

  if (sessionStart === true) {
    startSession(buggyIdNormalized, numericBuggyId);
  }

  addPoint(buggyIdNormalized, numericBuggyId, {
    lat: Number(lat),
    lng: Number(lng),
    speedKmh: typeof speedKmh === "number" ? speedKmh : null,
    accuracy: typeof accuracy === "number" ? accuracy : null,
    heading: typeof heading === "number" ? heading : null,
    altitude: typeof altitude === "number" ? altitude : null,
    batteryLevel:
      typeof batteryLevel === "number" &&
      batteryLevel >= 0 &&
      batteryLevel <= 100
        ? Math.round(batteryLevel)
        : null,
    recordedAt,
  });

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
