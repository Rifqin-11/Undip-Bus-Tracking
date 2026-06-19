/**
 * Buggy session history API.
 *
 * Combines persisted sessions with recent raw GPS points so active trips can
 * appear before an ESP sends `sessionEnd`. Access is role-aware: admin receives
 * all fleets, while driver receives only the assigned buggy aliases.
 */
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createAdminClient,
  createClient,
  getBuggySessionTableName,
  getBuggyHistoryTableName,
} from "@/lib/supabase/server";
import {
  buildSessionSummary,
  getOperationalSessionBucket,
  isSessionDistanceEligible,
} from "@/lib/realtime/session-store";
import type { SessionPoint } from "@/lib/realtime/session-store";
import {
  calculatePathDistanceKm,
  sanitizePath,
} from "@/lib/buggy/gps-quality";
import type { GpsPathPoint } from "@/lib/buggy/gps-quality";
import type { BuggySession } from "@/types/buggy-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HISTORY_PAGE_SIZE = 1_000;
const MAX_RAW_HISTORY_ROWS = 50_000;
const MAX_HISTORY_SESSION_SPEED_KMH = 60;
const SESSION_SUMMARY_COLUMNS =
  "id,buggy_id,session_date,session_number,started_at,ended_at,duration_minutes,total_distance_km,avg_speed_kmh,max_speed_kmh,battery_start,battery_end,battery_used,passenger_avg,passenger_peak,passenger_samples,point_count";

type HistoryAccessContext = {
  role: "Admin" | "Driver";
  buggyIdFilters: string[] | null;
};

function normalizeAssignmentKey(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/[\s_]/g, "-");
}

function extractAssignmentNumericId(value: string | null | undefined) {
  const normalized = normalizeAssignmentKey(value);
  const match =
    normalized.match(/^buggy-?0*(\d+)$/) ??
    normalized.match(/^b0*(\d+)$/) ??
    normalized.match(/^0*(\d+)$/);

  if (!match) return null;

  const numericId = Number.parseInt(match[1], 10);
  return Number.isFinite(numericId) ? numericId : null;
}

function addBuggyAliases(target: Set<string>, value: string | number | null | undefined) {
  if (value === null || value === undefined) return;
  const raw = String(value).trim();
  if (!raw) return;

  target.add(raw);

  const normalized = normalizeAssignmentKey(raw);
  if (normalized) target.add(normalized);

  const numericId = extractAssignmentNumericId(raw);
  if (numericId !== null) {
    target.add(String(numericId));
    target.add(`buggy-${numericId}`);
    target.add(`b${String(numericId).padStart(2, "0")}`);
  }
}

async function getHistoryAccessContext(
  adminSupabase: SupabaseClient,
): Promise<HistoryAccessContext | NextResponse> {
  // Session history is shared by admin and driver dashboards. Admin receives all
  // rows, while driver access is narrowed to aliases of the assigned buggy.
  let userSupabase: Awaited<ReturnType<typeof createClient>>;

  try {
    userSupabase = await createClient();
  } catch {
    return NextResponse.json(
      { message: "Authentication required." },
      { status: 401 },
    );
  }

  const {
    data: { user },
  } = await userSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { message: "Authentication required." },
      { status: 401 },
    );
  }

  const { data: account, error } = await userSupabase
    .from("accounts")
    .select("role, buggy_id")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !account) {
    return NextResponse.json(
      { message: "Account profile not found." },
      { status: 403 },
    );
  }

  if (account.role === "Admin") {
    return { role: "Admin", buggyIdFilters: null };
  }

  if (account.role !== "Driver") {
    return NextResponse.json(
      { message: "Admin or driver access required." },
      { status: 403 },
    );
  }

  const assignedBuggyId =
    typeof account.buggy_id === "string" ? account.buggy_id : "";
  const assignedKey = normalizeAssignmentKey(assignedBuggyId);
  const assignedNumericId = extractAssignmentNumericId(assignedBuggyId);
  const filters = new Set<string>();
  addBuggyAliases(filters, assignedBuggyId);

  const { data: buggies } = await adminSupabase
    .from("buggies")
    .select("id, code, name, numeric_id");

  if (Array.isArray(buggies)) {
    for (const buggy of buggies as Array<{
      id: string | null;
      code: string | null;
      name: string | null;
      numeric_id: number | null;
    }>) {
      const values = [buggy.id, buggy.code, buggy.name]
        .filter((value): value is string => Boolean(value))
        .map(normalizeAssignmentKey);
      const numericMatches =
        assignedNumericId !== null &&
        typeof buggy.numeric_id === "number" &&
        buggy.numeric_id === assignedNumericId;

      if (values.includes(assignedKey) || numericMatches) {
        addBuggyAliases(filters, buggy.id);
        addBuggyAliases(filters, buggy.code);
        addBuggyAliases(filters, buggy.name);
        addBuggyAliases(filters, buggy.numeric_id);
      }
    }
  }

  return { role: "Driver", buggyIdFilters: Array.from(filters) };
}

function filterIncludesBuggyId(filters: string[], buggyId: string) {
  const requested = new Set<string>();
  addBuggyAliases(requested, buggyId);
  return Array.from(requested).some((value) => filters.includes(value));
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

  return (Number.isFinite(aEndedAt) ? aEndedAt : 0) -
    (Number.isFinite(bEndedAt) ? bEndedAt : 0);
}

function dedupeSessionRows(rows: Record<string, unknown>[]) {
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

async function attachSessionPaths(
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

function parseRequestedSessionIds(value: string | null) {
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

// ── Row mapper ────────────────────────────────────────────────────────────────

function asNum(v: unknown): number | null {
  const n = Number(v);
  return v !== null && v !== undefined && !Number.isNaN(n) ? n : null;
}

function mapRow(row: Record<string, unknown>): BuggySession | null {
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
    path: sanitizedPath,
    sourceSessionIds: [String(row.id)],
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupPointsIntoSessions(points: SessionPoint[]): SessionPoint[][] {
  const sessions: SessionPoint[][] = [];
  let currentGroup: SessionPoint[] = [];

  for (const pt of points) {
    if (currentGroup.length === 0) {
      currentGroup.push(pt);
      continue;
    }
    const lastPt = currentGroup[currentGroup.length - 1];
    const gapMs = new Date(pt.recordedAt).getTime() - new Date(lastPt.recordedAt).getTime();
    const lastBucket = getOperationalSessionBucket(lastPt.recordedAt);
    const currentBucket = getOperationalSessionBucket(pt.recordedAt);
    
    // Sesi pagi (05-12) dan siang (13-17:30) digabung berdasarkan bucket waktu,
    // meskipun ada jeda ping. Di luar jam operasional, gap > 5 menit tetap
    // dianggap sesi lain agar data testing/off-hour tidak menyatu terlalu jauh.
    if (
      lastBucket.key !== currentBucket.key ||
      (!currentBucket.isScheduled && gapMs > 5 * 60_000)
    ) {
      sessions.push(currentGroup);
      currentGroup = [pt];
    } else {
      currentGroup.push(pt);
    }
  }
  if (currentGroup.length > 0) {
    sessions.push(currentGroup);
  }
  return sessions;
}

function mergeSessionsByOperationalBucket(
  sessions: BuggySession[],
): BuggySession[] {
  const groups = new Map<string, BuggySession[]>();

  for (const session of sessions) {
    const bucket = getOperationalSessionBucket(session.startedAt);
    const key = bucket.isScheduled
      ? `${session.buggyId}:${bucket.key}`
      : `${session.buggyId}:outside:${session.startedAt}:${session.endedAt}`;
    groups.set(key, [...(groups.get(key) ?? []), session]);
  }

  return Array.from(groups.values()).map((group) => {
    if (group.length === 1) return group[0];

    const ordered = [...group].sort(
      (a, b) =>
        new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
    );
    const first = ordered[0];
    const last = ordered.reduce((latest, session) =>
      new Date(session.endedAt).getTime() > new Date(latest.endedAt).getTime()
        ? session
        : latest,
    );
    const bucket = getOperationalSessionBucket(first.startedAt);
    const pathByKey = new Map<string, GpsPathPoint>();

    for (const session of ordered) {
      for (const [lat, lng, tsMs, passengers] of session.path) {
        const key = `${tsMs ?? ""}:${lat}:${lng}`;
        pathByKey.set(key, [lat, lng, tsMs, passengers]);
      }
    }

    const mergedPath = sanitizePath(
      Array.from(pathByKey.values()).sort(
        (a, b) => (a[2] ?? 0) - (b[2] ?? 0),
      ),
    );
    const startedAt = ordered[0].startedAt;
    const endedAt = last.endedAt;
    const durationMinutes = Math.max(
      0,
      (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60_000,
    );
    const totalDistanceKm =
      mergedPath.length >= 2 ? calculatePathDistanceKm(mergedPath) : 0;
    const avgSpeedKmh =
      durationMinutes > 0 ? totalDistanceKm / (durationMinutes / 60) : null;
    const passengerSamples = ordered.reduce(
      (sum, session) => sum + (session.passengerSamples ?? 0),
      0,
    );
    const passengerAvg =
      passengerSamples > 0
        ? ordered.reduce(
            (sum, session) =>
              sum +
              (session.passengerAvg ?? 0) * (session.passengerSamples ?? 0),
            0,
          ) / passengerSamples
        : null;
    const passengerPeak = Math.max(
      ...ordered
        .map((session) => session.passengerPeak ?? 0)
        .filter((value) => value > 0),
      0,
    ) || null;

    return {
      ...first,
      id: `merged-${first.buggyId}-${bucket.key}`,
      sessionDate: bucket.date,
      sessionNumber: bucket.sessionNumber,
      startedAt,
      endedAt,
      durationMinutes: Number(durationMinutes.toFixed(1)),
      pointCount: mergedPath.length,
      totalDistanceKm: Number(totalDistanceKm.toFixed(3)),
      avgSpeedKmh:
        avgSpeedKmh !== null ? Number(avgSpeedKmh.toFixed(1)) : null,
      maxSpeedKmh: Math.max(
        ...ordered
          .map((session) => session.maxSpeedKmh ?? 0)
          .filter((speed) => speed > 0),
        0,
      ) || null,
      batteryStart: ordered.find((session) => session.batteryStart !== null)
        ?.batteryStart ?? null,
      batteryEnd:
        [...ordered].reverse().find((session) => session.batteryEnd !== null)
          ?.batteryEnd ?? null,
      batteryUsed:
        ordered
          .map((session) => session.batteryUsed)
          .filter((value): value is number => value !== null)
          .reduce((sum, value) => sum + value, 0) || null,
      passengerAvg:
        passengerAvg !== null ? Number(passengerAvg.toFixed(1)) : null,
      passengerPeak,
      passengerSamples,
      path: mergedPath,
      isOngoing: ordered.some((session) => session.isOngoing),
      sourceSessionIds: ordered.flatMap((session) =>
        session.sourceSessionIds?.length ? session.sourceSessionIds : [session.id],
      ),
    };
  });
}

async function fetchRecentHistoryRows(
  supabase: SupabaseClient,
  sinceIso: string,
  buggyIdFilters: string[],
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  const tableName = getBuggyHistoryTableName();

  // Explicit columns — path is excluded to reduce egress.
  // Path is only needed when user opens session detail (loaded separately).
  const HISTORY_COLUMNS =
    "buggy_id,buggy_numeric_id,recorded_at,lat,lng,speed_kmh,passengers,accuracy,heading,altitude,battery_level";

  for (
    let offset = 0;
    offset < MAX_RAW_HISTORY_ROWS;
    offset += HISTORY_PAGE_SIZE
  ) {
    let query = supabase
      .from(tableName)
      .select(HISTORY_COLUMNS)
      .gte("recorded_at", sinceIso)
      .order("recorded_at", { ascending: true })
      .range(offset, offset + HISTORY_PAGE_SIZE - 1);

    if (buggyIdFilters.length === 1) {
      query = query.eq("buggy_id", buggyIdFilters[0]);
    } else if (buggyIdFilters.length > 1) {
      query = query.in("buggy_id", buggyIdFilters);
    }

    const { data, error } = await query;
    if (error) throw error;

    const pageRows = Array.isArray(data)
      ? (data as Record<string, unknown>[])
      : [];
    rows.push(...pageRows);

    if (pageRows.length < HISTORY_PAGE_SIZE) break;
  }

  return rows;
}

// ── GET /api/buggy-sessions ───────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const access = await getHistoryAccessContext(supabase);
  if (access instanceof NextResponse) return access;

  const params = request.nextUrl.searchParams;
  const buggyIdFilter = params.get("buggyId") ?? "";
  const limit = Math.min(Math.max(Number.parseInt(params.get("limit") ?? "100", 10), 1), 5000);
  const requestedSessionIds = parseRequestedSessionIds(params.get("ids"));
  const includePath =
    params.get("includePath") === "1" ||
    params.get("includePath") === "true" ||
    requestedSessionIds.length > 0;
  const buggyIdFilters =
    access.buggyIdFilters === null
      ? buggyIdFilter
        ? [buggyIdFilter]
        : []
      : buggyIdFilter
        ? filterIncludesBuggyId(access.buggyIdFilters, buggyIdFilter)
          ? access.buggyIdFilters
          : []
        : access.buggyIdFilters;

  if (access.role === "Driver" && buggyIdFilters.length === 0) {
    return NextResponse.json({ sessions: [], count: 0 });
  }

  const tableName = getBuggySessionTableName();

  if (requestedSessionIds.length > 0) {
    let detailQuery = supabase
      .from(tableName)
      .select(`${SESSION_SUMMARY_COLUMNS},path`)
      .in("id", requestedSessionIds);

    if (buggyIdFilters.length === 1) {
      detailQuery = detailQuery.eq("buggy_id", buggyIdFilters[0]);
    } else if (buggyIdFilters.length > 1) {
      detailQuery = detailQuery.in("buggy_id", buggyIdFilters);
    }

    const { data: detailData, error: detailError } = await detailQuery;
    if (detailError) {
      return NextResponse.json({ error: detailError.message }, { status: 500 });
    }

    const detailRows = Array.isArray(detailData)
      ? (detailData as Record<string, unknown>[])
      : [];
    const detailSessions = mergeSessionsByOperationalBucket(
      detailRows.map(mapRow).filter((s): s is BuggySession => s !== null),
    ).sort(
      (a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime(),
    );

    return NextResponse.json({
      sessions: detailSessions,
      count: detailSessions.length,
    });
  }

  const metadataLimit = Math.min(limit * 4, 5_000);

  let query = supabase
    .from(tableName)
    .select(SESSION_SUMMARY_COLUMNS)
    .order("started_at", { ascending: false })
    .limit(metadataLimit);

  if (buggyIdFilters.length === 1) {
    query = query.eq("buggy_id", buggyIdFilters[0]);
  } else if (buggyIdFilters.length > 1) {
    query = query.in("buggy_id", buggyIdFilters);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
  const dedupedRows = dedupeSessionRows(rows).slice(0, limit);
  let rowsWithPath = dedupedRows;

  if (includePath) {
    try {
      rowsWithPath = await attachSessionPaths(supabase, dedupedRows);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to load session paths",
        },
        { status: 500 },
      );
    }
  }

  const completed = rowsWithPath
    .map(mapRow)
    .filter((s): s is BuggySession => s !== null);

  // 1. Dapatkan "ended_at" paling akhir untuk setiap buggy
  const latestEndedAt = new Map<string, number>();
  for (const s of completed) {
    const t = new Date(s.endedAt).getTime();
    const current = latestEndedAt.get(s.buggyId);
    if (!current || t > current) {
      latestEndedAt.set(s.buggyId, t);
    }
  }

  // 2. Tarik raw GPS sejak awal hari operasional (06:00 WIB = 23:00 UTC hari sebelumnya).
  // Lebih hemat egress dibanding 24 jam penuh — sesi aktif yang belum tersimpan
  // paling jauh dimulai sejak shift pagi hari ini, bukan kemarin.
  // Jika sekarang masih sebelum 06:00 WIB, gunakan 06:00 WIB kemarin agar shift
  // semalam tidak terpotong.
  const WIB_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7
  const OPERATIONAL_START_HOUR_WIB = 6; // 06:00 WIB

  const nowWib = new Date(Date.now() + WIB_OFFSET_MS);
  const todayStart = new Date(
    Date.UTC(
      nowWib.getUTCFullYear(),
      nowWib.getUTCMonth(),
      nowWib.getUTCDate(),
      OPERATIONAL_START_HOUR_WIB - 7, // konversi WIB → UTC: -7 jam
      0,
      0,
      0,
    ),
  );

  // Jika sekarang masih sebelum 06:00 WIB hari ini, mundur ke 06:00 WIB kemarin.
  if (Date.now() < todayStart.getTime()) {
    todayStart.setUTCDate(todayStart.getUTCDate() - 1);
  }

  const rawGpsSince = todayStart.toISOString();

  let rawPoints: Record<string, unknown>[] = [];
  try {
    rawPoints = await fetchRecentHistoryRows(supabase, rawGpsSince, buggyIdFilters);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load raw buggy history",
      },
      { status: 500 },
    );
  }

  // Group titik-titik tersebut per buggy, dan ABAIKAN titik yang terekam sebelum "ended_at" terbaru sesi di DB
  const pointsByBuggy = new Map<string, { numericId: number | null; pts: SessionPoint[] }>();
  
  for (const row of rawPoints) {
    const bId = String(row.buggy_id);
    const recAt = new Date(String(row.recorded_at)).getTime();
    const latestFin = latestEndedAt.get(bId) || 0;
    const rawBucket = getOperationalSessionBucket(String(row.recorded_at));
    
    if (!rawBucket.isScheduled && recAt <= latestFin) continue;

    if (!pointsByBuggy.has(bId)) {
        pointsByBuggy.set(bId, { numericId: typeof row.buggy_numeric_id === "number" ? row.buggy_numeric_id : null, pts: [] });
    }
    
    const point = {
      lat: Number(row.lat),
      lng: Number(row.lng),
      speedKmh: asNum(row.speed_kmh),
      passengers: asNum(row.passengers),
      accuracy: asNum(row.accuracy),
      heading: asNum(row.heading),
      altitude: asNum(row.altitude),
      batteryLevel: asNum(row.battery_level),
      recordedAt: String(row.recorded_at),
    };

    pointsByBuggy.get(bId)!.pts.push(point);
  }

  const synthesizedOngoing: BuggySession[] = [];

  // 3. Gabungkan titik jadi sesi on-the-fly (Sintesis)
  // This makes the history UI resilient when the buggy has not sent a formal
  // sessionEnd event yet; active trips still appear immediately.
  for (const [bId, { pts }] of pointsByBuggy.entries()) {
    const groups = groupPointsIntoSessions(pts);
    
    for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        if (group.length === 0) continue;

        const isLatest = i === groups.length - 1;
        const lastRecAt = new Date(group[group.length - 1].recordedAt).getTime();
        const firstRecAt = new Date(group[0].recordedAt).getTime();
        const durationMinutes = Math.max(0, (lastRecAt - firstRecAt) / 60_000);
        const bucket = getOperationalSessionBucket(group[0].recordedAt);
        
        // Sesi terjadwal selesai ketika bucket waktunya sudah lewat. Sesi di
        // luar jam operasional tetap selesai jika tidak ada ping > 5 menit.
        const currentBucket = getOperationalSessionBucket(new Date());
        const isBucketClosed = bucket.key !== currentBucket.key;
        const isIdle = (Date.now() - lastRecAt) > 5 * 60_000;
        const shouldFinalize = bucket.isScheduled ? isBucketClosed : isIdle;
        
        const sum = buildSessionSummary(`synth-${bId}-${i}`, bId, group[0].recordedAt, group[group.length - 1].recordedAt, durationMinutes, group);

        const syntheticSession: BuggySession = {
            id: sum.id,
            buggyId: sum.buggyId,
            sessionDate: bucket.date,
            sessionNumber: bucket.sessionNumber,
            startedAt: sum.startedAt,
            endedAt: sum.lastPingAt,
            durationMinutes: sum.durationMinutes,
            pointCount: sum.pointCount,
            totalDistanceKm: sum.totalDistanceKm,
            avgSpeedKmh: sum.avgSpeedKmh,
            maxSpeedKmh: null,
            batteryStart: sum.batteryStart,
            batteryEnd: sum.currentBattery,
            batteryUsed: sum.batteryUsed,
            passengerAvg: sum.passengerAvg,
            passengerPeak: sum.passengerPeak,
            passengerSamples: sum.passengerSamples,
            path: sum.path,
        };

        // Completed sessions are persisted only after representing a real trip.
        // Ongoing sessions remain visible below for real-time monitoring.
        const isValidSession =
          sum.totalDistanceKm !== null &&
          isSessionDistanceEligible(sum.totalDistanceKm);

        if (shouldFinalize || !isLatest) {
            if (group.length >= 3 && isValidSession) {
                completed.push(syntheticSession);
            }
        } else {
            // Sesi ini masih berjalan (ping terakhir kurang dari 5 menit lalu)
            syntheticSession.isOngoing = true;
            // Tampilkan sesi aktif selalu agar buggy yang baru diam menyala tetap terlihat di UI (Nanti ia gugur sendiri kalau dimatikan sebelum 50m)
            synthesizedOngoing.push(syntheticSession);
        }
    }
  }

  // Ongoing sessions digabung dengan completed
  const sessions = mergeSessionsByOperationalBucket([
    ...synthesizedOngoing,
    ...completed,
  ]).sort(
    (a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime(),
  );

  return NextResponse.json({ sessions, count: sessions.length });
}
