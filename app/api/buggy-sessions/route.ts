import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, getBuggySessionTableName } from "@/lib/supabase/server";
import { getActiveSessionSummaries } from "@/lib/realtime/session-store";
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

  let path: [number, number][] = [];
  try {
    const raw =
      typeof row.path === "string" ? JSON.parse(row.path) : row.path;
    if (Array.isArray(raw)) path = raw as [number, number][];
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

  // ── Merge active (in-memory) sessions ───────────────────────────────────
  const activeSummaries = getActiveSessionSummaries();

  // Filter by buggyId if requested
  const filteredActive = buggyIdFilter
    ? activeSummaries.filter((s) => s.buggyId === buggyIdFilter)
    : activeSummaries;

  const ongoingSessions: BuggySession[] = filteredActive.map((s) => ({
    id: s.id,
    buggyId: s.buggyId,
    sessionDate: s.startedAt.slice(0, 10),
    sessionNumber: 0, // unknown until finalized, show as "ongoing"
    startedAt: s.startedAt,
    endedAt: s.lastPingAt, // current time as "end" for duration display
    durationMinutes: Number(s.durationMinutes.toFixed(1)),
    pointCount: s.pointCount,
    totalDistanceKm: Number(s.totalDistanceKm.toFixed(3)),
    avgSpeedKmh: s.avgSpeedKmh !== null ? Number(s.avgSpeedKmh.toFixed(1)) : null,
    maxSpeedKmh: null,
    batteryStart: s.batteryStart,
    batteryEnd: s.currentBattery,
    batteryUsed: s.batteryUsed,
    path: s.path,
    isOngoing: true,
  }));

  // Ongoing sessions first, then completed (API already ordered newest-first)
  const sessions = [...ongoingSessions, ...completed];

  return NextResponse.json({ sessions, count: sessions.length });
}
