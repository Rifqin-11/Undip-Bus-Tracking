import { NextRequest, NextResponse } from "next/server";
import { requireIngestToken } from "@/lib/auth/ingest-token";
import { ingestBuggyPayload, getBuggyByNumericId, adminDeactivateBuggyInStore } from "@/lib/realtime/buggy-live-store";
import {
  createAdminClient,
  getBuggyHistoryTableName,
} from "@/lib/supabase/server";
import {
  startSession,
  addPoint,
  finalizeSession,
} from "@/lib/realtime/session-store";
import { bootstrapFromDatabase } from "@/lib/supabase/data-loader";
import { normalizeGsmStatus } from "@/lib/buggy/gsm-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Membatasi insert ke Supabase maksimal 1 kali setiap 10 detik per buggy
const HISTORY_INSERT_INTERVAL_MS = 10_000;
const lastHistoryInsertPerBuggy: Record<number, number> = {};

function isSchemaColumnError(message: string) {
  return (
    message.includes("schema cache") ||
    message.includes("Could not find") ||
    message.includes("column")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * POST /api/gps-beacon
 *
 * Receives real GPS data from iPhone and injects it directly
 * into the live buggy store.
 *
 * Body: { buggyId, lat, lng, accuracy?, speedKmh?, heading?, altitude? }
 */
export async function POST(request: NextRequest) {
  const tokenError = requireIngestToken(request);
  if (tokenError) return tokenError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Allow both flat payloads and bridge logs shaped like { topic, data: {...} }.
  const bodyRecord = isRecord(body) ? body : {};
  const b = isRecord(bodyRecord.data) ? bodyRecord.data : bodyRecord;
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
    speed,
    speedKmh = 0,
    heading,
    altitude,
    etaMinutes,
    forceResync,
    batteryLevel,
    passengers,
    capacity,
    sessionStart,
    sessionEnd,
    source,
    gsm,
  } = b;

  const numericBuggyId = Number(buggyId);
  const buggyIdNormalized = `buggy-${numericBuggyId}`;
  const incomingPosition = { lat: Number(lat), lng: Number(lng) };

  // ── Bootstrap: pastikan data dari Supabase sudah dimuat ───────────────────
  await bootstrapFromDatabase();

  // ── Resolve UUID dari numericId ────────────────────────────────────────────
  // GPS beacon mengirim ID numerik (misal: 2), sedangkan live store memakai UUID
  // dari Supabase. Kita cari buggy yang punya numericId cocok.
  const matchedBuggy = getBuggyByNumericId(numericBuggyId);
  const resolvedBuggyId = matchedBuggy?.id ?? buggyIdNormalized;

  // ── Session: handle end FIRST (no GPS data needed) ───────────────────────
  if (sessionEnd === true) {
    // Deaktivasi buggy langsung di live store agar monitoring tampil offline seketika
    adminDeactivateBuggyInStore(resolvedBuggyId);
    await finalizeSession(resolvedBuggyId);
    return NextResponse.json({ ok: true, sessionEnded: true, buggyId: numericBuggyId });
  }

  const normalizedGsm = normalizeGsmStatus(gsm);

  // ── Live store ingest ─────────────────────────────────────────────────────
  const telemetryPayload = {
    telemetry: [
      {
        id: resolvedBuggyId,
        lat: incomingPosition.lat,
        lng: incomingPosition.lng,
        speedKmh:
          typeof speedKmh === "number"
            ? speedKmh
            : typeof speed === "number"
              ? speed
              : 0,
        accuracy: typeof accuracy === "number" ? accuracy : undefined,
        heading: typeof heading === "number" ? heading : undefined,
        altitude: typeof altitude === "number" ? altitude : undefined,
        etaMinutes: typeof etaMinutes === "number" ? etaMinutes : undefined,
        passengers: typeof passengers === "number" ? passengers : undefined,
        capacity: typeof capacity === "number" ? capacity : undefined,
        forceResync: forceResync === true,
        tag: typeof source === "string" ? source : "gps_beacon",
        timestamp: new Date().toISOString(),
        gsm: normalizedGsm,
      },
    ],
  };

  const result = ingestBuggyPayload(telemetryPayload);

  if (!result) {
    return NextResponse.json(
      { error: `Buggy numeric ID ${numericBuggyId} tidak ditemukan di database` },
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
      const historyRow = {
        buggy_id: buggyIdNormalized,
        buggy_numeric_id: numericBuggyId,
        lat: Number(lat),
        lng: Number(lng),
        accuracy: typeof accuracy === "number" ? accuracy : null,
        speed_kmh:
          typeof speedKmh === "number"
            ? speedKmh
            : typeof speed === "number"
              ? speed
              : 0,
        heading: typeof heading === "number" ? heading : null,
        altitude: typeof altitude === "number" ? altitude : null,
        battery_level:
          typeof batteryLevel === "number" &&
          batteryLevel >= 0 &&
          batteryLevel <= 100
            ? Math.round(batteryLevel)
            : null,
        passengers:
          typeof passengers === "number" && Number.isFinite(passengers)
            ? Math.max(0, Math.round(passengers))
            : null,
        capacity:
          typeof capacity === "number" && Number.isFinite(capacity)
            ? Math.max(1, Math.round(capacity))
            : null,
        source: typeof source === "string" ? source : "gps_beacon",
        recorded_at: new Date().toISOString(),
      };

      const { error } = await supabase.from(tableName).insert(historyRow);

      if (error) {
        if (isSchemaColumnError(error.message)) {
          const fallbackRow: Record<string, unknown> = { ...historyRow };
          delete fallbackRow.passengers;
          delete fallbackRow.capacity;
          const { error: fallbackError } = await supabase
            .from(tableName)
            .insert(fallbackRow);

          if (fallbackError) {
            console.warn("Supabase history insert failed:", fallbackError.message);
          }
        } else {
          console.warn("Supabase history insert failed:", error.message);
        }
      }
    }
  }

  // ── Session store: start / accumulate ─────────────────────────────────────
  const recordedAt = new Date().toISOString();

  if (sessionStart === true) {
    startSession(resolvedBuggyId, numericBuggyId);
  }

  addPoint(resolvedBuggyId, numericBuggyId, {
    lat: Number(lat),
    lng: Number(lng),
    speedKmh:
      typeof speedKmh === "number"
        ? speedKmh
        : typeof speed === "number"
          ? speed
          : null,
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
    gsm: normalizedGsm
      ? {
          apn: normalizedGsm.apn,
          signalPercent: normalizedGsm.signalPercent,
          networkConnected: normalizedGsm.networkConnected,
          gprsConnected: normalizedGsm.gprsConnected,
          mqttStateText: normalizedGsm.mqttStateText,
        }
      : null,
    updatedAt: result.updatedAt,
  });
}

/** GET /api/gps-beacon — health check */
export async function GET() {
  return NextResponse.json({ ok: true, message: "GPS Beacon API is running" });
}
