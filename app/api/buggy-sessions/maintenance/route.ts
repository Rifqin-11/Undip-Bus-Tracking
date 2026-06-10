/**
 * Buggy session maintenance worker.
 *
 * Runs write-heavy history maintenance outside the read API:
 * - deletes raw GPS rows older than retention
 * - materializes completed synthetic sessions from recent raw history
 */
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createAdminClient,
  getBuggyHistoryTableName,
} from "@/lib/supabase/server";
import {
  buildSessionSummary,
  getOperationalSessionBucket,
  isSessionDistanceEligible,
  saveSessionPointsToDb,
} from "@/lib/realtime/session-store";
import type { SessionPoint } from "@/lib/realtime/session-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HISTORY_PAGE_SIZE = 1_000;
const MAX_RAW_HISTORY_ROWS = 50_000;
const RAW_HISTORY_RETENTION_DAYS = 7;
const RECENT_HISTORY_WINDOW_HOURS = 48;

function isAuthorized(request: NextRequest) {
  const expectedToken = process.env.CRON_SECRET?.trim();
  if (!expectedToken) return false;

  return request.headers.get("authorization") === `Bearer ${expectedToken}`;
}

function asNum(value: unknown): number | null {
  const numeric = Number(value);
  return value !== null && value !== undefined && Number.isFinite(numeric)
    ? numeric
    : null;
}

function groupPointsIntoSessions(points: SessionPoint[]): SessionPoint[][] {
  const sessions: SessionPoint[][] = [];
  let currentGroup: SessionPoint[] = [];

  for (const point of points) {
    if (currentGroup.length === 0) {
      currentGroup.push(point);
      continue;
    }

    const lastPoint = currentGroup[currentGroup.length - 1];
    const gapMs =
      new Date(point.recordedAt).getTime() -
      new Date(lastPoint.recordedAt).getTime();
    const lastBucket = getOperationalSessionBucket(lastPoint.recordedAt);
    const currentBucket = getOperationalSessionBucket(point.recordedAt);

    if (
      lastBucket.key !== currentBucket.key ||
      (!currentBucket.isScheduled && gapMs > 5 * 60_000)
    ) {
      sessions.push(currentGroup);
      currentGroup = [point];
    } else {
      currentGroup.push(point);
    }
  }

  if (currentGroup.length > 0) sessions.push(currentGroup);
  return sessions;
}

async function fetchRecentHistoryRows(
  supabase: SupabaseClient,
  sinceIso: string,
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  const tableName = getBuggyHistoryTableName();

  for (
    let offset = 0;
    offset < MAX_RAW_HISTORY_ROWS;
    offset += HISTORY_PAGE_SIZE
  ) {
    const { data, error } = await supabase
      .from(tableName)
      .select(
        "buggy_id, buggy_numeric_id, lat, lng, speed_kmh, passengers, accuracy, heading, altitude, battery_level, recorded_at",
      )
      .gte("recorded_at", sinceIso)
      .order("recorded_at", { ascending: true })
      .range(offset, offset + HISTORY_PAGE_SIZE - 1);

    if (error) throw error;

    const pageRows = Array.isArray(data)
      ? (data as Record<string, unknown>[])
      : [];
    rows.push(...pageRows);

    if (pageRows.length < HISTORY_PAGE_SIZE) break;
  }

  return rows;
}

function groupRowsByBuggy(rows: Record<string, unknown>[]) {
  const pointsByBuggy = new Map<
    string,
    { numericId: number | null; points: SessionPoint[] }
  >();

  for (const row of rows) {
    const buggyId = String(row.buggy_id ?? "");
    if (!buggyId) continue;

    if (!pointsByBuggy.has(buggyId)) {
      pointsByBuggy.set(buggyId, {
        numericId:
          typeof row.buggy_numeric_id === "number"
            ? row.buggy_numeric_id
            : null,
        points: [],
      });
    }

    pointsByBuggy.get(buggyId)!.points.push({
      lat: Number(row.lat),
      lng: Number(row.lng),
      speedKmh: asNum(row.speed_kmh),
      passengers: asNum(row.passengers),
      accuracy: asNum(row.accuracy),
      heading: asNum(row.heading),
      altitude: asNum(row.altitude),
      batteryLevel: asNum(row.battery_level),
      recordedAt: String(row.recorded_at),
    });
  }

  return pointsByBuggy;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  try {
    const historyTable = getBuggyHistoryTableName();
    const retentionCutoff = new Date(
      Date.now() - RAW_HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { error: cleanupError, count: deletedRawRows } = await supabase
      .from(historyTable)
      .delete({ count: "exact" })
      .lt("recorded_at", retentionCutoff);

    if (cleanupError) throw cleanupError;

    const recentCutoff = new Date(
      Date.now() - RECENT_HISTORY_WINDOW_HOURS * 60 * 60 * 1000,
    ).toISOString();
    const rawRows = await fetchRecentHistoryRows(supabase, recentCutoff);
    const pointsByBuggy = groupRowsByBuggy(rawRows);

    let checkedGroups = 0;
    let savedGroups = 0;
    let skippedGroups = 0;

    for (const [buggyId, { numericId, points }] of pointsByBuggy.entries()) {
      const groups = groupPointsIntoSessions(points);

      for (let index = 0; index < groups.length; index += 1) {
        const group = groups[index];
        if (group.length < 3) {
          skippedGroups += 1;
          continue;
        }

        checkedGroups += 1;
        const isLatest = index === groups.length - 1;
        const lastRecordedAt = new Date(
          group[group.length - 1].recordedAt,
        ).getTime();
        const bucket = getOperationalSessionBucket(group[0].recordedAt);
        const currentBucket = getOperationalSessionBucket(new Date());
        const isBucketClosed = bucket.key !== currentBucket.key;
        const isIdle = Date.now() - lastRecordedAt > 5 * 60_000;
        const shouldFinalize = bucket.isScheduled ? isBucketClosed : isIdle;

        if (isLatest && !shouldFinalize) {
          skippedGroups += 1;
          continue;
        }

        const summary = buildSessionSummary(
          `maintenance-${buggyId}-${bucket.key}`,
          buggyId,
          group[0].recordedAt,
          group[group.length - 1].recordedAt,
          Math.max(
            0,
            (lastRecordedAt - new Date(group[0].recordedAt).getTime()) / 60_000,
          ),
          group,
        );

        if (!isSessionDistanceEligible(summary.totalDistanceKm)) {
          skippedGroups += 1;
          continue;
        }

        await saveSessionPointsToDb(buggyId, numericId, group, bucket.sessionNumber);
        savedGroups += 1;
      }
    }

    return NextResponse.json({
      ok: true,
      deletedRawRows: deletedRawRows ?? 0,
      rawRowsChecked: rawRows.length,
      checkedGroups,
      savedGroups,
      skippedGroups,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to run maintenance";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = POST;
