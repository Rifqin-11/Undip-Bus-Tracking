import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient, getBuggySessionTableName, getBuggyHistoryTableName } from "@/lib/supabase/server";
import {
  saveSessionPointsToDb,
  buildSessionSummary,
  getOperationalSessionBucket,
} from "@/lib/realtime/session-store";
import type { SessionPoint } from "@/lib/realtime/session-store";
import {
  calculatePathDistanceKm,
  sanitizePath,
} from "@/lib/buggy/gps-quality";
import type { BuggySession } from "@/types/buggy-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HISTORY_PAGE_SIZE = 1_000;
const MAX_RAW_HISTORY_ROWS = 50_000;

// ── Row mapper ────────────────────────────────────────────────────────────────

function asNum(v: unknown): number | null {
  const n = Number(v);
  return v !== null && v !== undefined && !Number.isNaN(n) ? n : null;
}

function mapRow(row: Record<string, unknown>): BuggySession | null {
  if (!row.id || !row.buggy_id || !row.started_at || !row.ended_at) return null;

  let path: [number, number, number][] = [];
  try {
    const raw =
      typeof row.path === "string" ? JSON.parse(row.path) : row.path;
    if (Array.isArray(raw)) path = raw as [number, number, number][];
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
    path: sanitizedPath as [number, number, number?][],
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
    
    // Sesi pagi (06-12) dan siang (13-17) digabung berdasarkan bucket waktu,
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
    const pathByKey = new Map<string, [number, number, number?]>();

    for (const session of ordered) {
      for (const [lat, lng, tsMs] of session.path) {
        const key = `${tsMs ?? ""}:${lat}:${lng}`;
        pathByKey.set(key, [lat, lng, tsMs]);
      }
    }

    const mergedPath = sanitizePath(
      Array.from(pathByKey.values()).sort(
        (a, b) => (a[2] ?? 0) - (b[2] ?? 0),
      ) as [number, number, number][],
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
      path: mergedPath as [number, number, number?][],
      isOngoing: ordered.some((session) => session.isOngoing),
    };
  });
}

async function fetchRecentHistoryRows(
  supabase: SupabaseClient,
  sinceIso: string,
  buggyIdFilter: string,
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  const tableName = getBuggyHistoryTableName();

  for (
    let offset = 0;
    offset < MAX_RAW_HISTORY_ROWS;
    offset += HISTORY_PAGE_SIZE
  ) {
    let query = supabase
      .from(tableName)
      .select("*")
      .gte("recorded_at", sinceIso)
      .order("recorded_at", { ascending: true })
      .range(offset, offset + HISTORY_PAGE_SIZE - 1);

    if (buggyIdFilter) {
      query = query.eq("buggy_id", buggyIdFilter);
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
  const adminGuard = await requireAdmin();
  if (!adminGuard.authorized) return adminGuard.response;

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const params = request.nextUrl.searchParams;
  const buggyIdFilter = params.get("buggyId") ?? "";
  const limit = Math.min(Math.max(Number.parseInt(params.get("limit") ?? "100", 10), 1), 500);

  // Background Cleanup: Auto-hapus data mentah GPS (buggy_history) yang usianya lebih dari 3 hari.
  // Dilakukan tanpa blocking thread (fire-and-forget) agar dashboard tetap kencang.
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
  supabase.from(getBuggyHistoryTableName()).delete().lt("recorded_at", threeDaysAgo).then(() => {});

  const tableName = getBuggySessionTableName();

  let query = supabase
    .from(tableName)
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (buggyIdFilter) {
    query = query.eq("buggy_id", buggyIdFilter);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
  const completed = rows.map(mapRow).filter((s): s is BuggySession => s !== null);

  // 1. Dapatkan "ended_at" paling akhir untuk setiap buggy
  const latestEndedAt = new Map<string, number>();
  for (const s of completed) {
    const t = new Date(s.endedAt).getTime();
    const current = latestEndedAt.get(s.buggyId);
    if (!current || t > current) {
      latestEndedAt.set(s.buggyId, t);
    }
  }

  // 2. Tarik semua data ping raw GPS yang terjadi SEJAK H-1 (untuk mencari sesi yang belum sempat tersimpan)
  const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  
  let rawPoints: Record<string, unknown>[] = [];
  try {
    rawPoints = await fetchRecentHistoryRows(supabase, yesterday, buggyIdFilter);
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
      accuracy: asNum(row.accuracy),
      heading: asNum(row.heading),
      altitude: asNum(row.altitude),
      batteryLevel: asNum(row.battery_level),
      recordedAt: String(row.recorded_at),
    };

    pointsByBuggy.get(bId)!.pts.push(point);
  }

  const synthesizedOngoing: BuggySession[] = [];
  const saves: Promise<void>[] = [];

  // 3. Gabungkan titik jadi sesi on-the-fly (Sintesis)
  for (const [bId, { numericId, pts }] of pointsByBuggy.entries()) {
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
            path: sum.path,
        };

        // Sesi pagi/siang tetap disimpan walau jarak kecil. Batas 1 km hanya
        // dipakai untuk data di luar jam operasional agar noise/testing tidak
        // menjadi riwayat permanen.
        const isValidSession =
          bucket.isScheduled ||
          (sum.totalDistanceKm !== null && sum.totalDistanceKm >= 1.0);

        if (shouldFinalize || !isLatest) {
            // Sesi sudah terputus. Kita FINALISASIKAN ke database di background agar permanen.
            if (group.length >= 3 && isValidSession) {
                saves.push(saveSessionPointsToDb(bId, numericId, group, bucket.sessionNumber).catch(e => console.error("Auto-finalize error:", e)));
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

  // Eksekusi auto-finalize ke DB secara background tanpa memblokir request pengguna
  if (saves.length > 0) {
      Promise.allSettled(saves);
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
