import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, getBuggySessionTableName, getBuggyHistoryTableName } from "@/lib/supabase/server";
import { saveSessionPointsToDb, buildSessionSummary } from "@/lib/realtime/session-store";
import type { SessionPoint } from "@/lib/realtime/session-store";
import type { BuggySession } from "@/types/buggy-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  return {
    id: String(row.id),
    buggyId: String(row.buggy_id),
    sessionDate: String(row.session_date ?? "").slice(0, 10),
    sessionNumber: Number(row.session_number ?? 1),
    startedAt: String(row.started_at),
    endedAt: String(row.ended_at),
    durationMinutes: asNum(row.duration_minutes),
    pointCount: Number(row.point_count ?? 0),
    totalDistanceKm: asNum(row.total_distance_km),
    avgSpeedKmh: asNum(row.avg_speed_kmh),
    maxSpeedKmh: asNum(row.max_speed_kmh),
    batteryStart: asNum(row.battery_start),
    batteryEnd: asNum(row.battery_end),
    batteryUsed: asNum(row.battery_used),
    path,
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
    
    // Gap of > 5 minutes indicates a new session
    if (gapMs > 5 * 60_000) {
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

// ── GET /api/buggy-sessions ───────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const params = request.nextUrl.searchParams;
  const buggyIdFilter = params.get("buggyId") ?? "";
  const limit = Math.min(Math.max(Number.parseInt(params.get("limit") ?? "100", 10), 1), 500);

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
  
  let historyQuery = supabase
    .from(getBuggyHistoryTableName())
    .select('*')
    .gte('recorded_at', yesterday)
    .order('recorded_at', { ascending: true }); // Harus Ascending agar runut waktu

  if (buggyIdFilter) {
    historyQuery = historyQuery.eq("buggy_id", buggyIdFilter);
  }
    
  const { data: rawPointsData } = await historyQuery;
  const rawPoints = Array.isArray(rawPointsData) ? rawPointsData : [];

  // Group titik-titik tersebut per buggy, dan ABAIKAN titik yang terekam sebelum "ended_at" terbaru sesi di DB
  const pointsByBuggy = new Map<string, { numericId: number | null; pts: SessionPoint[] }>();
  
  for (const row of rawPoints) {
    const bId = String(row.buggy_id);
    const recAt = new Date(String(row.recorded_at)).getTime();
    const latestFin = latestEndedAt.get(bId) || 0;
    
    if (recAt <= latestFin) continue;

    if (!pointsByBuggy.has(bId)) {
        pointsByBuggy.set(bId, { numericId: typeof row.buggy_numeric_id === "number" ? row.buggy_numeric_id : null, pts: [] });
    }
    
    pointsByBuggy.get(bId)!.pts.push({
      lat: Number(row.lat),
      lng: Number(row.lng),
      speedKmh: asNum(row.speed_kmh),
      accuracy: asNum(row.accuracy),
      heading: asNum(row.heading),
      altitude: asNum(row.altitude),
      batteryLevel: asNum(row.battery_level),
      recordedAt: String(row.recorded_at),
    });
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
        
        // Sesi usang jika tidak ada ping > 5 menit
        const isIdle = (Date.now() - lastRecAt) > 5 * 60_000;
        
        const sum = buildSessionSummary(`synth-${bId}-${i}`, bId, group[0].recordedAt, group[group.length - 1].recordedAt, durationMinutes, group);

        const syntheticSession: BuggySession = {
            id: sum.id,
            buggyId: sum.buggyId,
            sessionDate: sum.startedAt.slice(0, 10),
            sessionNumber: 0,
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

        if (isIdle || !isLatest) {
            // Sesi sudah terputus. Kita FINALISASIKAN ke database di background agar permanen.
            // (Minimal 3 titik baru pantas disimpan permanen)
            if (group.length >= 3) {
                saves.push(saveSessionPointsToDb(bId, numericId, group).catch(e => console.error("Auto-finalize error:", e)));
                completed.push(syntheticSession);
            }
        } else {
            // Sesi ini masih berjalan (ping terakhir kurang dari 5 menit lalu)
            syntheticSession.isOngoing = true;
            synthesizedOngoing.push(syntheticSession);
        }
    }
  }

  // Eksekusi auto-finalize ke DB secara background tanpa memblokir request pengguna
  if (saves.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      Promise.allSettled(saves);
  }

  // Urutkan completed berdasarkan startedAt karena ada yang dari sintesis
  completed.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  // Ongoing sessions digabung dengan completed
  const sessions = [...synthesizedOngoing, ...completed];

  return NextResponse.json({ sessions, count: sessions.length });
}
