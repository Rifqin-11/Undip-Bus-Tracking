/**
 * Production GPS beacon ingest API.
 *
 * This is the canonical telemetry entry point for MQTT bridge payloads. It
 * validates the ingest token, resolves devicesId/deviceId to the assigned buggy,
 * updates live state, and persists latest/history/session data.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireIngestToken } from "@/lib/auth/ingest-token";
import {
  ingestBuggyPayload,
  getBuggyByNumericId,
  adminDeactivateBuggyInStore,
  adminUpdateBuggyInStore,
} from "@/lib/realtime/buggy-live-store";
import {
  createAdminClient,
  getBuggyHistoryTableName,
  getLatestBuggyTelemetryTableName,
} from "@/lib/supabase/server";
import {
  startSession,
  addPoint,
  finalizeSession,
  touchSession,
} from "@/lib/realtime/session-store";
import { bootstrapFromDatabase } from "@/lib/supabase/data-loader";
import { normalizeGsmStatus } from "@/lib/buggy/gsm-status";
import { haversineMeters } from "@/lib/transit/buggy-route-utils";
import {
  isKnownNoFixCoordinate,
  isSameGpsCoordinate,
} from "@/lib/buggy/gps-quality";
import {
  normalizeDevicesId,
  recordSeenDevice,
  resolveActiveDeviceAssignment,
} from "@/lib/buggy/device-assignment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Membatasi insert ke Supabase maksimal 1 kali setiap 10 detik per buggy
const HISTORY_INSERT_INTERVAL_MS = 10_000;
const HISTORY_DISTANCE_THRESHOLD_METERS = 10;
const HISTORY_SPEED_DELTA_THRESHOLD_KMH = 5;
const lastHistoryInsertPerBuggy: Record<
  string,
  { insertedAtMs: number; lat: number; lng: number; speedKmh: number }
> = {};

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

function shouldInsertHistoryPoint(
  historyKey: string,
  lat: number,
  lng: number,
  speedKmh: number,
  now: number,
): boolean {
  const currentPoint = { lat, lng };
  if (isKnownNoFixCoordinate(currentPoint)) return false;

  const lastInsert = lastHistoryInsertPerBuggy[historyKey];
  if (!lastInsert) return true;
  if (isSameGpsCoordinate(lastInsert, currentPoint)) return false;

  const elapsedMs = now - lastInsert.insertedAtMs;
  const distanceMeters = haversineMeters(
    { lat: lastInsert.lat, lng: lastInsert.lng },
    { lat, lng },
  );
  const speedDeltaKmh = Math.abs(speedKmh - lastInsert.speedKmh);

  return (
    elapsedMs >= HISTORY_INSERT_INTERVAL_MS ||
    distanceMeters >= HISTORY_DISTANCE_THRESHOLD_METERS ||
    speedDeltaKmh >= HISTORY_SPEED_DELTA_THRESHOLD_KMH
  );
}

function markHistoryPointInserted(
  historyKey: string,
  lat: number,
  lng: number,
  speedKmh: number,
  insertedAtMs: number,
) {
  lastHistoryInsertPerBuggy[historyKey] = {
    insertedAtMs,
    lat,
    lng,
    speedKmh,
  };
}

function normalizePassengerCount(
  value: unknown,
  capacity: number | null | undefined,
): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const safeCapacity =
    typeof capacity === "number" && Number.isFinite(capacity) && capacity > 0
      ? Math.round(capacity)
      : 22;

  return Math.min(safeCapacity, Math.max(0, Math.round(value)));
}

/**
 * POST /api/gps-beacon
 *
 * Receives telemetry from the MQTT bridge or legacy clients and applies it to
 * the currently assigned buggy. The device assignment table is the canonical
 * source of truth; legacy buggyId is accepted only for backward compatibility.
 *
 * Body: { devicesId/deviceId, lat, lng, accuracy?, speedKmh?, heading?, altitude? }
 * Legacy body with { buggyId, ... } is still accepted for compatibility.
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
  const normalizedGsm = normalizeGsmStatus(b.gsm);
  const isStatusOnly = b.statusOnly === true || (!isSessionEnd && !("lat" in b) && !("lng" in b) && Boolean(normalizedGsm));

  if (
    !isSessionEnd &&
    !isStatusOnly &&
    (typeof b.lat !== "number" || typeof b.lng !== "number")
  ) {
    return NextResponse.json(
      { error: "Missing required fields: lat, lng" },
      { status: 400 },
    );
  }

  const {
    buggyId,
    buggy_id,
    deviceId,
    device_id,
    devicesId,
    devices_id,
    lat,
    lng,
    accuracy,
    speed,
    speedKmh,
    heading,
    altitude,
    etaMinutes,
    forceResync,
    batteryLevel,
    passengers,
    sessionStart,
    sessionEnd,
    stationaryHeartbeat,
    source,
  } = b;

  const incomingDevicesId =
    normalizeDevicesId(devicesId) ??
    normalizeDevicesId(devices_id) ??
    normalizeDevicesId(deviceId) ??
    normalizeDevicesId(device_id);
  const legacyBuggyId = buggyId ?? buggy_id;
  const incomingPosition = { lat: Number(lat), lng: Number(lng) };

  // ── Bootstrap: pastikan data dari Supabase sudah dimuat ───────────────────
  await bootstrapFromDatabase();

  let resolvedBuggyId: string | null = null;
  let numericBuggyId: number | null = null;
  let identitySource: "device_assignment" | "legacy_buggy_id" = "legacy_buggy_id";

  if (incomingDevicesId) {
    await recordSeenDevice(incomingDevicesId, {
      lat: typeof lat === "number" ? lat : null,
      lng: typeof lng === "number" ? lng : null,
      speed: typeof speed === "number" ? speed : null,
      speedKmh: typeof speedKmh === "number" ? speedKmh : null,
      passengers: typeof passengers === "number" ? passengers : null,
      gpsValid: typeof b.gpsValid === "boolean" ? b.gpsValid : null,
      topic: typeof bodyRecord.topic === "string" ? bodyRecord.topic : null,
      receivedAt: new Date().toISOString(),
    });

    // A physical ESP can be moved between fleets without reflashing firmware.
    // The backend resolves devicesId -> buggy_id on every ingest request.
    const { assignment, error } =
      await resolveActiveDeviceAssignment(incomingDevicesId);

    if (error) {
      return NextResponse.json(
        {
          error: "Gagal membaca assignment device.",
          devicesId: incomingDevicesId,
          detail: error,
        },
        { status: 500 },
      );
    }

    if (!assignment) {
      return NextResponse.json(
        {
          error:
            "Device belum diassign ke buggy. Atur assignment device di web admin terlebih dahulu.",
          devicesId: incomingDevicesId,
        },
        { status: 409 },
      );
    }

    resolvedBuggyId = assignment.buggyId;
    numericBuggyId = assignment.buggyNumericId;
    identitySource = "device_assignment";
  } else if (legacyBuggyId !== undefined && legacyBuggyId !== null) {
    const parsedNumericBuggyId = Number(legacyBuggyId);
    if (Number.isFinite(parsedNumericBuggyId)) {
      const matchedBuggy = getBuggyByNumericId(parsedNumericBuggyId);
      resolvedBuggyId = matchedBuggy?.id ?? `buggy-${parsedNumericBuggyId}`;
      numericBuggyId = matchedBuggy?.numericId ?? parsedNumericBuggyId;
    } else if (typeof legacyBuggyId === "string" && legacyBuggyId.trim()) {
      resolvedBuggyId = legacyBuggyId.trim();
      numericBuggyId = null;
    }
  }

  if (!resolvedBuggyId) {
    return NextResponse.json(
      {
        error:
          "Missing device identity. Kirim devicesId/deviceId, atau buggyId untuk payload lama.",
      },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  // ── Session: handle end FIRST (no GPS data needed) ───────────────────────
  if (sessionEnd === true) {
    // Deaktivasi buggy langsung di live store agar monitoring tampil offline seketika
    adminDeactivateBuggyInStore(resolvedBuggyId);
    await finalizeSession(resolvedBuggyId);
    return NextResponse.json({
      ok: true,
      sessionEnded: true,
      devicesId: incomingDevicesId,
      buggyId: resolvedBuggyId,
      buggyNumericId: numericBuggyId,
      identitySource,
    });
  }

  if (supabase) {
    const { data: buggyVisibility, error: visibilityError } = await supabase
      .from("buggies")
      .select("is_active")
      .eq("id", resolvedBuggyId)
      .maybeSingle();

    if (visibilityError) {
      return NextResponse.json(
        {
          error: "Gagal membaca status hide fleet.",
          detail: visibilityError.message,
        },
        { status: 500 },
      );
    }

    if (buggyVisibility?.is_active === false) {
      return NextResponse.json(
        {
          error: "Fleet sedang di-hide, payload GPS tidak diterapkan ke live map.",
          devicesId: incomingDevicesId,
          buggyId: resolvedBuggyId,
        },
        { status: 409 },
      );
    }
  }

  if (isStatusOnly) {
    const receivedAt = new Date().toISOString();
    if (normalizedGsm) {
      adminUpdateBuggyInStore(resolvedBuggyId, { gsm: normalizedGsm });
    }

    let statusTelemetryUpdated = false;
    if (supabase && normalizedGsm) {
      const statusPatch = {
        devices_id: incomingDevicesId,
        gsm: normalizedGsm,
        received_at: receivedAt,
        updated_at: receivedAt,
      };
      const { data, error } = await supabase
        .from(getLatestBuggyTelemetryTableName())
        .update(statusPatch)
        .eq("buggy_id", resolvedBuggyId)
        .select("buggy_id")
        .maybeSingle();

      if (error) {
        if (isSchemaColumnError(error.message)) {
          const fallbackPatch: Record<string, unknown> = { ...statusPatch };
          delete fallbackPatch.devices_id;
          delete fallbackPatch.received_at;
          const { data: fallbackData, error: fallbackError } = await supabase
            .from(getLatestBuggyTelemetryTableName())
            .update(fallbackPatch)
            .eq("buggy_id", resolvedBuggyId)
            .select("buggy_id")
            .maybeSingle();

          if (fallbackError) {
            console.warn(
              "Supabase status telemetry update failed:",
              fallbackError.message,
            );
          } else {
            statusTelemetryUpdated = Boolean(fallbackData);
          }
        } else {
          console.warn("Supabase status telemetry update failed:", error.message);
        }
      } else {
        statusTelemetryUpdated = Boolean(data);
      }
    }

    return NextResponse.json({
      ok: true,
      statusOnly: true,
      statusTelemetryUpdated,
      devicesId: incomingDevicesId,
      buggyId: resolvedBuggyId,
      buggyNumericId: numericBuggyId,
      identitySource,
      gsm: normalizedGsm
        ? {
            apn: normalizedGsm.apn,
            signalPercent: normalizedGsm.signalPercent,
            networkConnected: normalizedGsm.networkConnected,
            gprsConnected: normalizedGsm.gprsConnected,
            mqttStateText: normalizedGsm.mqttStateText,
          }
        : null,
    });
  }

  const incomingSpeedKmh =
    typeof speedKmh === "number"
      ? speedKmh
      : typeof speed === "number"
        ? speed
        : 0;
  const recordedAt = new Date().toISOString();
  const existingLiveBuggy =
    typeof numericBuggyId === "number"
      ? getBuggyByNumericId(numericBuggyId)
      : undefined;
  const normalizedPassengers = normalizePassengerCount(
    passengers,
    existingLiveBuggy?.capacity,
  );

  // The same accepted point updates four operational views:
  // 1) in-memory live map, 2) latest telemetry row, 3) raw history points,
  // and 4) session aggregation for trip history.
  // ── Live store ingest ─────────────────────────────────────────────────────
  const telemetryPayload = {
    telemetry: [
      {
        id: resolvedBuggyId,
        lat: incomingPosition.lat,
        lng: incomingPosition.lng,
        speedKmh: incomingSpeedKmh,
        accuracy: typeof accuracy === "number" ? accuracy : undefined,
        heading: typeof heading === "number" ? heading : undefined,
        altitude: typeof altitude === "number" ? altitude : undefined,
        etaMinutes: typeof etaMinutes === "number" ? etaMinutes : undefined,
        passengers: normalizedPassengers ?? undefined,
        forceResync: forceResync === true,
        tag: typeof source === "string" ? source : "gps_beacon",
        timestamp: recordedAt,
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

  const liveBuggy =
    typeof numericBuggyId === "number"
      ? getBuggyByNumericId(numericBuggyId)
      : undefined;

  const receivedAt = new Date().toISOString();
  const telemetryRow = {
    buggy_id: resolvedBuggyId,
    buggy_numeric_id: numericBuggyId,
    devices_id: incomingDevicesId,
    lat: Number(lat),
    lng: Number(lng),
    accuracy: typeof accuracy === "number" ? accuracy : null,
    speed_kmh: incomingSpeedKmh,
    heading: typeof heading === "number" ? heading : null,
    altitude: typeof altitude === "number" ? altitude : null,
    battery_level:
      typeof batteryLevel === "number" &&
      batteryLevel >= 0 &&
      batteryLevel <= 100
        ? Math.round(batteryLevel)
        : null,
    passengers: normalizedPassengers,
    gsm: normalizedGsm,
    source: typeof source === "string" ? source : "gps_beacon",
    recorded_at: recordedAt,
    received_at: receivedAt,
    path_cursor: liveBuggy?.pathCursor ?? null,
    current_stop_index: liveBuggy?.currentStopIndex ?? null,
  };

  if (supabase) {
    const { error } = await supabase
      .from(getLatestBuggyTelemetryTableName())
      .upsert(
        {
          ...telemetryRow,
          updated_at: receivedAt,
        },
        { onConflict: "buggy_id" },
      );

    if (error) {
      if (isSchemaColumnError(error.message)) {
        const fallbackTelemetryRow: Record<string, unknown> = {
          ...telemetryRow,
          updated_at: receivedAt,
        };
        delete fallbackTelemetryRow.devices_id;
        delete fallbackTelemetryRow.received_at;
        delete fallbackTelemetryRow.path_cursor;
        delete fallbackTelemetryRow.current_stop_index;
        const { error: fallbackError } = await supabase
          .from(getLatestBuggyTelemetryTableName())
          .upsert(fallbackTelemetryRow, { onConflict: "buggy_id" });

        if (fallbackError) {
          console.warn(
            "Supabase latest telemetry upsert failed:",
            fallbackError.message,
          );
        }
      } else {
        console.warn("Supabase latest telemetry upsert failed:", error.message);
      }
    }
  }

  // Best effort persistence for admin trip history (do not block live ingest).
  const now = Date.now();

  const shouldPersistGpsPoint = stationaryHeartbeat !== true;

  if (
    shouldPersistGpsPoint &&
    shouldInsertHistoryPoint(
      resolvedBuggyId,
      incomingPosition.lat,
      incomingPosition.lng,
      incomingSpeedKmh,
      now,
    )
  ) {
    if (supabase) {
      const tableName = getBuggyHistoryTableName();
      const historyRow = {
        buggy_id: telemetryRow.buggy_id,
        buggy_numeric_id: telemetryRow.buggy_numeric_id,
        devices_id: telemetryRow.devices_id,
        lat: telemetryRow.lat,
        lng: telemetryRow.lng,
        accuracy: telemetryRow.accuracy,
        speed_kmh: telemetryRow.speed_kmh,
        heading: telemetryRow.heading,
        altitude: telemetryRow.altitude,
        battery_level: telemetryRow.battery_level,
        passengers: telemetryRow.passengers,
        source: telemetryRow.source,
        recorded_at: telemetryRow.recorded_at,
      };

      const { error } = await supabase.from(tableName).insert(historyRow);

      if (error) {
        if (isSchemaColumnError(error.message)) {
          const fallbackRow: Record<string, unknown> = { ...historyRow };
          delete fallbackRow.devices_id;
          delete fallbackRow.passengers;
          const { error: fallbackError } = await supabase
            .from(tableName)
            .insert(fallbackRow);

          if (fallbackError) {
            console.warn("Supabase history insert failed:", fallbackError.message);
          } else {
            markHistoryPointInserted(
              resolvedBuggyId,
              incomingPosition.lat,
              incomingPosition.lng,
              incomingSpeedKmh,
              now,
            );
          }
        } else {
          console.warn("Supabase history insert failed:", error.message);
        }
      } else {
        markHistoryPointInserted(
          resolvedBuggyId,
          incomingPosition.lat,
          incomingPosition.lng,
          incomingSpeedKmh,
          now,
        );
      }
    } else {
      markHistoryPointInserted(
        resolvedBuggyId,
        incomingPosition.lat,
        incomingPosition.lng,
        incomingSpeedKmh,
        now,
      );
    }
  }

  // ── Session store: start / accumulate ─────────────────────────────────────
  if (sessionStart === true) {
    startSession(resolvedBuggyId, numericBuggyId);
  }

  if (shouldPersistGpsPoint) {
    addPoint(resolvedBuggyId, numericBuggyId, {
      lat: Number(lat),
      lng: Number(lng),
      speedKmh: incomingSpeedKmh,
      passengers: normalizedPassengers,
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
  } else {
    touchSession(resolvedBuggyId);
  }

  return NextResponse.json({
    ok: true,
    accepted: result.accepted,
    devicesId: incomingDevicesId,
    buggyId: resolvedBuggyId,
    buggyNumericId: numericBuggyId,
    identitySource,
    stationaryHeartbeat: stationaryHeartbeat === true,
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
