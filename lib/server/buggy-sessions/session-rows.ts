import type { SupabaseClient } from "@supabase/supabase-js";
import { getBuggySessionTableName } from "@/lib/supabase/server";
import {
  calculatePathDistanceKm,
  sanitizePath,
} from "@/lib/buggy/gps-quality";
import type { GpsPathPoint } from "@/lib/buggy/gps-quality";
import type { BuggySession } from "@/types/buggy-session";

const MAX_HISTORY_SESSION_SPEED_KMH = 60;

export const SESSION_SUMMARY_COLUMNS =
  "id,buggy_id,session_date,session_number,started_at,ended_at,duration_minutes,total_distance_km,avg_speed_kmh,max_speed_kmh,battery_start,battery_end,battery_used,passenger_avg,passenger_peak,passenger_samples,point_count";

export function asNum(v: unknown): number | null {
  const n = Number(v);
  return v !== null && v !== undefined && !Number.isNaN(n) ? n : null;
}

function getSessionRowKey(row: Record<string, unknown>) {
  const buggyId = String(row.buggy_id ?? "unknown");
  const startedAt =
    typeof row.started_at === "string" ? new Date(row.started_at) : null;
  const sessionDate =
    typeof row.session_date === "string" && row.session_date
      ? row.session_date.slice(0, 10)
      : startedAt && !Number.isNaN(startedAt.getTime())
        ? startedAt.toISOString().slice(0, 10)
        : "unknown";
  const sessionNumber = String(row.session_number ?? "");

  return sessionNumber
    ? `${buggyId}:${sessionDate}:${sessionNumber}`
    : `${buggyId}:${String(row.started_at ?? "")}:${String(row.ended_at ?? "")}`;
}

function getImpliedSessionSpeedKmh(row: Record<string, unknown>) {
  const distanceKm = asNum(row.total_distance_km) ?? 0;
  const durationMinutes = asNum(row.duration_minutes) ?? 0;

  if (distanceKm <= 0) return 0;
  if (durationMinutes <= 0) return Number.POSITIVE_INFINITY;

  return distanceKm / (durationMinutes / 60);
}

function isSessionRowQualityEligible(row: Record<string, unknown>) {
  const impliedSpeedKmh = getImpliedSessionSpeedKmh(row);
  const recordedAvgSpeedKmh = asNum(row.avg_speed_kmh) ?? 0;

  return (
    impliedSpeedKmh <= MAX_HISTORY_SESSION_SPEED_KMH &&
    recordedAvgSpeedKmh <= MAX_HISTORY_SESSION_SPEED_KMH
  );
}

function compareSessionRowQuality(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
) {
  const aEligible = isSessionRowQualityEligible(a);
  const bEligible = isSessionRowQualityEligible(b);
  if (aEligible !== bEligible) return Number(aEligible) - Number(bEligible);

  const aPoints = asNum(a.point_count) ?? 0;
  const bPoints = asNum(b.point_count) ?? 0;
  if (aPoints !== bPoints) return aPoints - bPoints;

  const aDuration = asNum(a.duration_minutes) ?? 0;
  const bDuration = asNum(b.duration_minutes) ?? 0;
  if (aDuration !== bDuration) return aDuration - bDuration;

  const aDistance = asNum(a.total_distance_km) ?? 0;
  const bDistance = asNum(b.total_distance_km) ?? 0;
  if (aDistance !== bDistance) return aDistance - bDistance;

  const aEndedAt =
    typeof a.ended_at === "string" ? new Date(a.ended_at).getTime() : 0;
  const bEndedAt =
    typeof b.ended_at === "string" ? new Date(b.ended_at).getTime() : 0;

  return (
    (Number.isFinite(aEndedAt) ? aEndedAt : 0) -
    (Number.isFinite(bEndedAt) ? bEndedAt : 0)
  );
}

export function dedupeSessionRows(rows: Record<string, unknown>[]) {
  const byKey = new Map<string, Record<string, unknown>>();

  for (const row of rows) {
    const key = getSessionRowKey(row);
    const existing = byKey.get(key);
    if (!existing || compareSessionRowQuality(row, existing) > 0) {
      byKey.set(key, row);
    }
  }

  return Array.from(byKey.values()).sort(
    (a, b) =>
      new Date(String(b.ended_at ?? b.started_at ?? 0)).getTime() -
      new Date(String(a.ended_at ?? a.started_at ?? 0)).getTime(),
  );
}

export async function attachSessionPaths(
  supabase: SupabaseClient,
  rows: Record<string, unknown>[],
) {
  const ids = rows
    .map((row) => (typeof row.id === "string" ? row.id : null))
    .filter((id): id is string => Boolean(id));

  if (ids.length === 0) return rows;

  const { data, error } = await supabase
    .from(getBuggySessionTableName())
    .select("id,path")
    .in("id", ids);

  if (error) throw error;

  const pathById = new Map(
    (Array.isArray(data) ? (data as Record<string, unknown>[]) : [])
      .filter((row) => typeof row.id === "string")
      .map((row) => [String(row.id), row.path]),
  );

  return rows.map((row) => ({
    ...row,
    path: typeof row.id === "string" ? pathById.get(row.id) : undefined,
  }));
}

export function parseRequestedSessionIds(value: string | null) {
  if (!value) return [];

  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  ).slice(0, 20);
}

export function mapRow(row: Record<string, unknown>): BuggySession | null {
  if (!row.id || !row.buggy_id || !row.started_at || !row.ended_at) return null;

  let path: GpsPathPoint[] = [];
  try {
    const raw =
      typeof row.path === "string" ? JSON.parse(row.path) : row.path;
    if (Array.isArray(raw)) path = raw as GpsPathPoint[];
  } catch {
    path = [];
  }

  const sanitizedPath = sanitizePath(path);
  const sanitizedDistanceKm =
    sanitizedPath.length >= 2 ? calculatePathDistanceKm(sanitizedPath) : 0;

  return {
    id: String(row.id),
    buggyId: String(row.buggy_id),
    sessionDate: String(row.session_date ?? "").slice(0, 10),
    sessionNumber: Number(row.session_number ?? 1),
    startedAt: String(row.started_at),
    endedAt: String(row.ended_at),
    durationMinutes: asNum(row.duration_minutes),
    pointCount: sanitizedPath.length || Number(row.point_count ?? 0),
    totalDistanceKm:
      sanitizedPath.length >= 2
        ? Number(sanitizedDistanceKm.toFixed(3))
        : asNum(row.total_distance_km),
    avgSpeedKmh: asNum(row.avg_speed_kmh),
    maxSpeedKmh: asNum(row.max_speed_kmh),
    batteryStart: asNum(row.battery_start),
    batteryEnd: asNum(row.battery_end),
    batteryUsed: asNum(row.battery_used),
    passengerAvg: asNum(row.passenger_avg),
    passengerPeak: asNum(row.passenger_peak),
    passengerSamples: Number(row.passenger_samples ?? 0),
    passengerBoardings: asNum(row.passenger_boardings),
    path: sanitizedPath,
    sourceSessionIds: [String(row.id)],
  };
}
