/**
 * In-memory session accumulator.
 *
 * Lifecycle:
 *   1. GPS tracker sends `sessionStart: true` → startSession()
 *   2. Each GPS ping → addPoint()
 *   3. GPS tracker sends `sessionEnd: true` → finalizeSession()
 *   4. If no ping for SESSION_IDLE_TIMEOUT_MS → auto-finalize(background interval)
 *
 * Completed sessions are persisted to Supabase `buggy_session_history` table.
 */

import { createAdminClient, getBuggySessionTableName } from "@/lib/supabase/server";
import { haversineMeters } from "@/lib/transit/buggy-route-utils";
import {
  calculatePathDistanceKm,
  sanitizeGpsPoints,
  sanitizePath,
} from "@/lib/buggy/gps-quality";

// ── Config ───────────────────────────────────────────────────────────────────

const SESSION_IDLE_TIMEOUT_MS = 5 * 60 * 1000; // auto-finalize after 5 min silence
const MIN_POINTS_TO_SAVE = 3;                   // discard micro-sessions
export const MIN_SESSION_DISTANCE_KM = 1.0;
const OPERATIONAL_TIME_ZONE = "Asia/Jakarta";

// ── Types ────────────────────────────────────────────────────────────────────

export type SessionPoint = {
  lat: number;
  lng: number;
  speedKmh: number | null;
  passengers: number | null;
  accuracy: number | null;
  heading: number | null;
  altitude: number | null;
  batteryLevel: number | null;
  recordedAt: string; // ISO
};

type ActiveSession = {
  sessionId: string;
  buggyId: string;
  buggyNumericId: number | null;
  sessionKey: string;
  sessionNumber: number;
  startedAt: string;    // ISO
  lastPingAt: number;   // Date.now()
  points: SessionPoint[];
  pendingJumpPoints: SessionPoint[];
};

export type ActiveSessionSummary = {
  id: string;             // sessionId
  buggyId: string;
  startedAt: string;
  lastPingAt: string;     // ISO
  pointCount: number;
  durationMinutes: number;
  totalDistanceKm: number;
  avgSpeedKmh: number | null;
  batteryStart: number | null;
  currentBattery: number | null;
  batteryUsed: number | null;
  passengerAvg: number | null;
  passengerPeak: number | null;
  passengerSamples: number;
  path: [number, number, number, number?][];
};

// ── Global state (survives HMR in dev) ───────────────────────────────────────

declare global {
  var __BUGGY_SESSIONS__: Map<string, ActiveSession> | undefined;
  var __SESSION_GC_INTERVAL__: ReturnType<typeof setInterval> | undefined;
  var __SESSION_SAVE_INFLIGHT__: Map<string, Promise<void>> | undefined;
}

function getSessionMap(): Map<string, ActiveSession> {
  if (!globalThis.__BUGGY_SESSIONS__) {
    globalThis.__BUGGY_SESSIONS__ = new Map();
  }
  return globalThis.__BUGGY_SESSIONS__;
}

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function getSaveInflightMap(): Map<string, Promise<void>> {
  if (!globalThis.__SESSION_SAVE_INFLIGHT__) {
    globalThis.__SESSION_SAVE_INFLIGHT__ = new Map();
  }
  return globalThis.__SESSION_SAVE_INFLIGHT__;
}

function isSchemaColumnError(message: string): boolean {
  return (
    message.includes("schema cache") ||
    message.includes("Could not find") ||
    message.includes("column")
  );
}

function isMissingConflictConstraintError(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return (
    lowerMessage.includes("no unique") ||
    lowerMessage.includes("no exclusion constraint") ||
    lowerMessage.includes("conflict")
  );
}

function getJakartaDateParts(value: string | number | Date): {
  date: string;
  hour: number;
  minute: number;
} {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: OPERATIONAL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const partMap = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return {
    date: `${partMap.year}-${partMap.month}-${partMap.day}`,
    hour: Number(partMap.hour ?? 0),
    minute: Number(partMap.minute ?? 0),
  };
}

export function getOperationalSessionBucket(value: string | number | Date): {
  date: string;
  key: string;
  sessionNumber: number;
  isScheduled: boolean;
} {
  const { date, hour, minute } = getJakartaDateParts(value);
  const minutesSinceMidnight = hour * 60 + minute;

  if (minutesSinceMidnight >= 5 * 60 && minutesSinceMidnight < 12 * 60) {
    return {
      date,
      key: `${date}:morning`,
      sessionNumber: 1,
      isScheduled: true,
    };
  }

  if (
    minutesSinceMidnight >= 13 * 60 &&
    minutesSinceMidnight <= 17 * 60 + 30
  ) {
    return {
      date,
      key: `${date}:afternoon`,
      sessionNumber: 2,
      isScheduled: true,
    };
  }

  return {
    date,
    key: `${date}:outside`,
    sessionNumber: 3,
    isScheduled: false,
  };
}

/**
 * Completed sessions must represent an actual trip, regardless of whether the
 * points were recorded inside or outside an operational schedule bucket.
 */
export function isSessionDistanceEligible(totalDistanceKm: number): boolean {
  return (
    Number.isFinite(totalDistanceKm) &&
    totalDistanceKm >= MIN_SESSION_DISTANCE_KM
  );
}

// ── Background auto-finalize ──────────────────────────────────────────────────

function ensureGC(): void {
  if (globalThis.__SESSION_GC_INTERVAL__) return;

  globalThis.__SESSION_GC_INTERVAL__ = setInterval(() => {
    const now = Date.now();
    const sessions = getSessionMap();

    for (const [buggyId, session] of sessions) {
      const currentBucket = getOperationalSessionBucket(new Date());
      if (
        session.sessionKey === currentBucket.key &&
        currentBucket.isScheduled
      ) {
        continue;
      }

      if (now - session.lastPingAt > SESSION_IDLE_TIMEOUT_MS) {
        console.log(`[session-store] Auto-finalizing stale session for ${buggyId} (no ping for 5 min)`);
        void finalizeSession(buggyId);
      }
    }
  }, 60_000); // run every minute
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Start a new session for a buggy.
 * If there is already an active session, it will be finalized first.
 */
export function startSession(
  buggyId: string,
  buggyNumericId: number | null,
): void {
  ensureGC();
  const sessions = getSessionMap();
  const bucket = getOperationalSessionBucket(new Date());

  const existing = sessions.get(buggyId);
  if (existing?.sessionKey === bucket.key) {
    existing.lastPingAt = Date.now();
    return;
  }

  // Finalize any lingering session from a different operational bucket.
  if (existing) {
    console.log(`[session-store] New start for ${buggyId} — finalizing previous session`);
    void finalizeSession(buggyId);
  }

  sessions.set(buggyId, {
    sessionId: makeId(),
    buggyId,
    buggyNumericId,
    sessionKey: bucket.key,
    sessionNumber: bucket.sessionNumber,
    startedAt: new Date().toISOString(),
    lastPingAt: Date.now(),
    points: [],
    pendingJumpPoints: [],
  });

  console.log(`[session-store] Session started for ${buggyId}`);
}

export function touchSession(buggyId: string): void {
  const session = getSessionMap().get(buggyId);
  if (session) {
    session.lastPingAt = Date.now();
  }
}

/**
 * Add a GPS point to the active session.
 * If there is no active session (e.g. server restart), one is created automatically.
 */
export function addPoint(
  buggyId: string,
  buggyNumericId: number | null,
  point: SessionPoint,
): void {
  if (sanitizeGpsPoints([point]).length === 0) {
    console.warn(
      `[session-store] Ignoring invalid GPS point for ${buggyId}: ` +
        `${point.lat}, ${point.lng}`,
    );
    return;
  }

  ensureGC();
  const sessions = getSessionMap();
  let session = sessions.get(buggyId);
  const pointBucket = getOperationalSessionBucket(point.recordedAt);

  if (session && session.sessionKey !== pointBucket.key) {
    console.log(
      `[session-store] Session bucket changed for ${buggyId}: ` +
        `${session.sessionKey} -> ${pointBucket.key}`,
    );
    void finalizeSession(buggyId);
    session = undefined;
  }

  if (!session) {
    // Auto-create session (handles server restart / no sessionStart signal)
    session = {
      sessionId: makeId(),
      buggyId,
      buggyNumericId,
      sessionKey: pointBucket.key,
      sessionNumber: pointBucket.sessionNumber,
      startedAt: point.recordedAt,
      lastPingAt: Date.now(),
      points: [],
      pendingJumpPoints: [],
    };
    sessions.set(buggyId, session);
  }

  const candidatePoints = [...session.pendingJumpPoints, point];
  const nextPoints = sanitizeGpsPoints([...session.points, ...candidatePoints]);
  if (nextPoints.length === session.points.length) {
    session.pendingJumpPoints = candidatePoints.slice(-4);
    console.warn(
      `[session-store] Ignoring GPS jump outlier for ${buggyId}: ` +
        `${point.lat}, ${point.lng}`,
    );
    return;
  }

  session.points = nextPoints;
  session.pendingJumpPoints = [];
  session.lastPingAt = Date.now();
}

/**
 * Return lightweight stats for all currently active (in-memory) sessions.
 * Used by the API to show "ongoing" sessions in the History panel.
 */
export function getActiveSessionSummaries(): ActiveSessionSummary[] {
  const sessions = getSessionMap();
  const summaries: ActiveSessionSummary[] = [];

  for (const [, session] of sessions) {
    const durationMinutes =
      (Date.now() - new Date(session.startedAt).getTime()) / 60_000;

    summaries.push(
      buildSessionSummary(
        session.sessionId,
        session.buggyId,
        session.startedAt,
        new Date(session.lastPingAt).toISOString(),
        durationMinutes,
        session.points,
      ),
    );
  }

  return summaries;
}

/**
 * Reusable function to build session stats from raw points.
 */
export function buildSessionSummary(
  sessionId: string,
  buggyId: string,
  startedAt: string,
  lastPingAtIso: string,
  durationMinutes: number,
  points: SessionPoint[],
): ActiveSessionSummary {
  points = sanitizeGpsPoints(points);

  const speeds = points
    .map((p) => p.speedKmh)
    .filter((s): s is number => s !== null && s > 0.5);
  const avgSpeedKmh =
    speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : null;

  const withBattery = points.filter((p) => p.batteryLevel !== null);
  const batteryStart =
    withBattery.length > 0 ? (withBattery[0].batteryLevel as number) : null;
  const currentBattery =
    withBattery.length > 0
      ? (withBattery[withBattery.length - 1].batteryLevel as number)
      : null;
  const batteryUsed =
    batteryStart !== null && currentBattery !== null
      ? batteryStart - currentBattery
      : null;
  const passengerValues = points
    .map((p) => p.passengers)
    .filter((value): value is number => value !== null && value >= 0);
  const passengerAvg =
    passengerValues.length > 0
      ? passengerValues.reduce((sum, value) => sum + value, 0) /
        passengerValues.length
      : null;
  const passengerPeak =
    passengerValues.length > 0 ? Math.max(...passengerValues) : null;

  const rawPath: [number, number, number, number?][] = points.map((p) => {
    const tuple: [number, number, number, number?] = [
      p.lat,
      p.lng,
      new Date(p.recordedAt).getTime(),
    ];

    if (typeof p.passengers === "number" && Number.isFinite(p.passengers)) {
      tuple[3] = p.passengers;
    }

    return tuple;
  });
  const path = sanitizePath(rawPath) as [number, number, number, number?][];
  const totalDistanceKm =
    path.length >= 2 ? calculatePathDistanceKm(path) : 0;

  return {
    id: sessionId,
    buggyId,
    startedAt,
    lastPingAt: lastPingAtIso,
    pointCount: points.length,
    durationMinutes,
    totalDistanceKm,
    avgSpeedKmh,
    batteryStart,
    currentBattery,
    batteryUsed,
    passengerAvg,
    passengerPeak,
    passengerSamples: passengerValues.length,
    path,
  };
}
export async function finalizeSession(buggyId: string): Promise<void> {
  const sessions = getSessionMap();
  const session = sessions.get(buggyId);

  if (!session) return;

  // Hapus segera agar tidak di-finalize dua kali
  sessions.delete(buggyId);

  const points = sanitizeGpsPoints(session.points);

  if (points.length < MIN_POINTS_TO_SAVE) {
    console.log(`[session-store] Too few points (${points.length}) for ${buggyId}, discarding`);
    return;
  }

  // Hitung total jarak tempuh sebelum simpan ke DB
  let totalDistanceM = 0;
  for (let i = 1; i < points.length; i++) {
    totalDistanceM += haversineMeters(
      { lat: points[i - 1].lat, lng: points[i - 1].lng },
      { lat: points[i].lat, lng: points[i].lng },
    );
  }
  const totalDistanceKm = totalDistanceM / 1000;

  if (!isSessionDistanceEligible(totalDistanceKm)) {
    console.log(
      `[session-store] Jarak terlalu pendek (${totalDistanceKm.toFixed(3)} km < ${MIN_SESSION_DISTANCE_KM} km) ` +
      `untuk ${buggyId}, sesi tidak disimpan.`,
    );
    return;
  }

  await saveSessionPointsToDb(
    buggyId,
    session.buggyNumericId,
    points,
    session.sessionNumber,
  );
}

/**
 * Direct entry point for saving a purely DB-synthesized session.
 */
export async function saveSessionPointsToDb(
  buggyId: string,
  buggyNumericId: number | null,
  points: SessionPoint[],
  forcedSessionNumber?: number,
): Promise<void> {
  points = sanitizeGpsPoints(points);
  if (points.length < MIN_POINTS_TO_SAVE) return;

  const startedAt = points[0]?.recordedAt || new Date().toISOString();
  const endedAt = points[points.length - 1]?.recordedAt || new Date().toISOString();

  // ── Compute stats ────────────────────────────────────────────────────────

  // Total distance (sum of haversine between consecutive points)
  let totalDistanceM = 0;
  for (let i = 1; i < points.length; i++) {
    totalDistanceM += haversineMeters(
      { lat: points[i - 1].lat, lng: points[i - 1].lng },
      { lat: points[i].lat, lng: points[i].lng },
    );
  }
  const totalDistanceKm = totalDistanceM / 1000;

  // This is the final persistence boundary. Keep the guard here so every
  // caller, including DB-synthesized auto-finalization, follows the same rule.
  if (!isSessionDistanceEligible(totalDistanceKm)) {
    console.log(
      `[session-store] Jarak terlalu pendek (${totalDistanceKm.toFixed(3)} km < ${MIN_SESSION_DISTANCE_KM} km) ` +
        `untuk ${buggyId}, sesi tidak disimpan.`,
    );
    return;
  }

  // Average / max speed (exclude 0 and null)
  const speeds = points
    .map((p) => p.speedKmh)
    .filter((s): s is number => s !== null && s > 0.5);
  const avgSpeedKmh =
    speeds.length > 0
      ? speeds.reduce((a, b) => a + b, 0) / speeds.length
      : null;
  const maxSpeedKmh = speeds.length > 0 ? Math.max(...speeds) : null;

  // Battery
  const withBattery = points.filter((p) => p.batteryLevel !== null);
  const batteryStart =
    withBattery.length > 0 ? (withBattery[0].batteryLevel as number) : null;
  const batteryEnd =
    withBattery.length > 0
      ? (withBattery[withBattery.length - 1].batteryLevel as number)
      : null;
  const batteryUsed =
    batteryStart !== null && batteryEnd !== null
      ? batteryStart - batteryEnd
      : null;
  const passengerValues = points
    .map((p) => p.passengers)
    .filter((value): value is number => value !== null && value >= 0);
  const passengerAvg =
    passengerValues.length > 0
      ? passengerValues.reduce((sum, value) => sum + value, 0) /
        passengerValues.length
      : null;
  const passengerPeak =
    passengerValues.length > 0 ? Math.max(...passengerValues) : null;

  // Duration
  const startMs = new Date(startedAt).getTime();
  const endMs = new Date(endedAt).getTime();
  const durationMinutes = Math.max(0, (endMs - startMs) / 60_000);

  const bucket = getOperationalSessionBucket(startedAt);
  const sessionDate = bucket.date;

  // Path (downsample to max 500 points to keep Supabase row small)
  const MAX_PATH_POINTS = 500;
  let pathSource = points;
  if (points.length > MAX_PATH_POINTS) {
    const step = Math.ceil(points.length / MAX_PATH_POINTS);
    pathSource = points.filter((_, i) => i % step === 0);
    // Always keep last point
    const last = points[points.length - 1];
    if (pathSource[pathSource.length - 1] !== last) pathSource.push(last);
  }
  // Store [lat, lng, unixMs, passengers?] so exports can show per-point values.
  const path = pathSource.map((p) => {
    const tuple: [number, number, number, number?] = [
      p.lat,
      p.lng,
      new Date(p.recordedAt).getTime(),
    ];

    if (typeof p.passengers === "number" && Number.isFinite(p.passengers)) {
      tuple[3] = p.passengers;
    }

    return tuple;
  });

  // ── Persist to Supabase ──────────────────────────────────────────────────

  const supabase = createAdminClient();
  if (!supabase) {
    console.warn("[session-store] No Supabase client — session data lost");
    return;
  }

  const tableName = getBuggySessionTableName();
  const sessionNumber = forcedSessionNumber ?? bucket.sessionNumber;
  const dedupeKey = `${buggyId}|${sessionDate}|${sessionNumber}`;
  const inflight = getSaveInflightMap();

  const running = inflight.get(dedupeKey);
  if (running) {
    await running;
    return;
  }

  const persistPromise = (async () => {
    // Hard guard idempotensi: one operational bucket should produce one durable
    // session per buggy. Synthetic reconstruction can shift started_at slightly,
    // so bucket identity is more stable than exact timestamps.
    const { data: existingRows, error: existingError } = await supabase
      .from(tableName)
      .select("id")
      .eq("buggy_id", buggyId)
      .eq("session_date", sessionDate)
      .eq("session_number", sessionNumber)
      .limit(1);

    if (existingError) {
      console.warn(
        `[session-store] Existing-session check failed for ${buggyId}: ${existingError.message}`,
      );
    }

    if (Array.isArray(existingRows) && existingRows.length > 0) {
      console.log(
        `[session-store] Skip duplicate session for ${buggyId} (${sessionDate} #${sessionNumber})`,
      );
      return;
    }

    const sessionRow = {
      buggy_id: buggyId,
      buggy_numeric_id: buggyNumericId,
      session_date: sessionDate,
      session_number: sessionNumber,
      started_at: startedAt,
      ended_at: endedAt,
      duration_minutes: Number(durationMinutes.toFixed(1)),
      point_count: points.length,
      total_distance_km: Number(totalDistanceKm.toFixed(3)),
      avg_speed_kmh: avgSpeedKmh !== null ? Number(avgSpeedKmh.toFixed(1)) : null,
      max_speed_kmh: maxSpeedKmh !== null ? Number(maxSpeedKmh.toFixed(1)) : null,
      battery_start: batteryStart,
      battery_end: batteryEnd,
      battery_used: batteryUsed,
      passenger_avg:
        passengerAvg !== null ? Number(passengerAvg.toFixed(1)) : null,
      passenger_peak: passengerPeak,
      passenger_samples: passengerValues.length,
      path,
    };

    let { error } = await supabase
      .from(tableName)
      .upsert(sessionRow, {
        onConflict: "buggy_id,session_date,session_number",
        ignoreDuplicates: true,
      });

    if (error && isMissingConflictConstraintError(error.message)) {
      const fallbackResult = await supabase
        .from(tableName)
        .upsert(sessionRow, {
          onConflict: "buggy_id,started_at,ended_at",
          ignoreDuplicates: true,
        });
      error = fallbackResult.error;
    }

    if (error) {
      if (isSchemaColumnError(error.message)) {
        const fallbackRow: Record<string, unknown> = { ...sessionRow };
        delete fallbackRow.passenger_avg;
        delete fallbackRow.passenger_peak;
        delete fallbackRow.passenger_samples;
        let { error: fallbackError } = await supabase
          .from(tableName)
          .upsert(fallbackRow, {
            onConflict: "buggy_id,session_date,session_number",
            ignoreDuplicates: true,
          });

        if (
          fallbackError &&
          isMissingConflictConstraintError(fallbackError.message)
        ) {
          const legacyFallbackResult = await supabase
            .from(tableName)
            .upsert(fallbackRow, {
              onConflict: "buggy_id,started_at,ended_at",
              ignoreDuplicates: true,
            });
          fallbackError = legacyFallbackResult.error;
        }

        if (fallbackError) {
          console.error(
            `[session-store] Save failed for ${buggyId}:`,
            fallbackError.message,
          );
          return;
        }

        console.warn(
          `[session-store] Saved session for ${buggyId} without passenger metrics; apply passenger migration.`,
        );
        return;
      }

      console.error(`[session-store] Save failed for ${buggyId}:`, error.message);
    } else {
      console.log(
        `[session-store] Saved session #${sessionNumber} for ${buggyId}: ` +
          `${points.length} pts, ${totalDistanceKm.toFixed(2)} km`,
      );
    }
  })();

  inflight.set(dedupeKey, persistPromise);
  try {
    await persistPromise;
  } finally {
    inflight.delete(dedupeKey);
  }
}
