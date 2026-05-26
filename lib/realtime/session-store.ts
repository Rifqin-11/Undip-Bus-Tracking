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
import { sanitizeGpsPoints } from "@/lib/buggy/gps-quality";

// ── Config ───────────────────────────────────────────────────────────────────

const SESSION_IDLE_TIMEOUT_MS = 5 * 60 * 1000; // auto-finalize after 5 min silence
const MIN_POINTS_TO_SAVE = 3;                   // discard micro-sessions
const MIN_DISTANCE_KM    = 1.0;                 // discard sesi yang belum menempuh 1 km
const OPERATIONAL_TIME_ZONE = "Asia/Jakarta";

// ── Types ────────────────────────────────────────────────────────────────────

export type SessionPoint = {
  lat: number;
  lng: number;
  speedKmh: number | null;
  accuracy: number | null;
  heading: number | null;
  altitude: number | null;
  batteryLevel: number | null;
  recordedAt: string; // ISO
};

type ActiveSession = {
  sessionId: string;
  buggyId: string;
  buggyNumericId: number;
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
  path: [number, number, number][];
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

function getJakartaDateParts(value: string | number | Date): {
  date: string;
  hour: number;
} {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: OPERATIONAL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const partMap = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return {
    date: `${partMap.year}-${partMap.month}-${partMap.day}`,
    hour: Number(partMap.hour ?? 0),
  };
}

export function getOperationalSessionBucket(value: string | number | Date): {
  date: string;
  key: string;
  sessionNumber: number;
  isScheduled: boolean;
} {
  const { date, hour } = getJakartaDateParts(value);

  if (hour >= 6 && hour < 12) {
    return {
      date,
      key: `${date}:morning`,
      sessionNumber: 1,
      isScheduled: true,
    };
  }

  if (hour >= 13 && hour < 17) {
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
export function startSession(buggyId: string, buggyNumericId: number): void {
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

/**
 * Add a GPS point to the active session.
 * If there is no active session (e.g. server restart), one is created automatically.
 */
export function addPoint(
  buggyId: string,
  buggyNumericId: number,
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

  let totalDistanceM = 0;
  for (let i = 1; i < points.length; i++) {
    totalDistanceM += haversineMeters(
      { lat: points[i - 1].lat, lng: points[i - 1].lng },
      { lat: points[i].lat, lng: points[i].lng },
    );
  }

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

  const path: [number, number, number][] = points.map((p) => [
    p.lat,
    p.lng,
    new Date(p.recordedAt).getTime(),
  ]);

  return {
    id: sessionId,
    buggyId,
    startedAt,
    lastPingAt: lastPingAtIso,
    pointCount: points.length,
    durationMinutes,
    totalDistanceKm: totalDistanceM / 1000,
    avgSpeedKmh,
    batteryStart,
    currentBattery,
    batteryUsed,
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
  const bucket = getOperationalSessionBucket(points[0].recordedAt);

  if (!bucket.isScheduled && totalDistanceKm < MIN_DISTANCE_KM) {
    console.log(
      `[session-store] Jarak terlalu pendek (${totalDistanceKm.toFixed(3)} km < ${MIN_DISTANCE_KM} km) ` +
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
  // Store [lat, lng, unixMs] so the panel can display per-point timestamps
  const path = pathSource.map((p) => [
    p.lat,
    p.lng,
    new Date(p.recordedAt).getTime(),
  ]);

  // ── Persist to Supabase ──────────────────────────────────────────────────

  const supabase = createAdminClient();
  if (!supabase) {
    console.warn("[session-store] No Supabase client — session data lost");
    return;
  }

  const tableName = getBuggySessionTableName();
  const dedupeKey = `${buggyId}|${startedAt}|${endedAt}`;
  const inflight = getSaveInflightMap();

  const running = inflight.get(dedupeKey);
  if (running) {
    await running;
    return;
  }

  const persistPromise = (async () => {
    // Hard guard idempotensi: jika sesi dengan rentang waktu yang sama sudah ada, skip.
    const { data: existingRows, error: existingError } = await supabase
      .from(tableName)
      .select("id")
      .eq("buggy_id", buggyId)
      .eq("started_at", startedAt)
      .eq("ended_at", endedAt)
      .limit(1);

    if (existingError) {
      console.warn(
        `[session-store] Existing-session check failed for ${buggyId}: ${existingError.message}`,
      );
    }

    if (Array.isArray(existingRows) && existingRows.length > 0) {
      console.log(
        `[session-store] Skip duplicate session for ${buggyId} (${startedAt} -> ${endedAt})`,
      );
      return;
    }

    const sessionNumber = forcedSessionNumber ?? bucket.sessionNumber;

    const sessionRow = {
      buggy_id: buggyId,
      buggy_numeric_id: buggyNumericId,
      session_date: sessionDate,
      session_number: sessionNumber,
      started_at: startedAt,
      ended_at: endedAt,
      duration_minutes: Number(durationMinutes.toFixed(1)),
      point_count: points.length,
      total_distance_km: Number((totalDistanceM / 1000).toFixed(3)),
      avg_speed_kmh: avgSpeedKmh !== null ? Number(avgSpeedKmh.toFixed(1)) : null,
      max_speed_kmh: maxSpeedKmh !== null ? Number(maxSpeedKmh.toFixed(1)) : null,
      battery_start: batteryStart,
      battery_end: batteryEnd,
      battery_used: batteryUsed,
      path,
    };

    const { error } = await supabase
      .from(tableName)
      .upsert(sessionRow, {
        onConflict: "buggy_id,started_at,ended_at",
        ignoreDuplicates: true,
      });

    if (error) {
      console.error(`[session-store] Save failed for ${buggyId}:`, error.message);
    } else {
      console.log(
        `[session-store] Saved session #${sessionNumber} for ${buggyId}: ` +
          `${points.length} pts, ${(totalDistanceM / 1000).toFixed(2)} km`,
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
