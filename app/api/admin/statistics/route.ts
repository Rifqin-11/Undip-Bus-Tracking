/**
 * Admin operational statistics API.
 *
 * Aggregates completed session rows into monthly fleet metrics for the admin
 * dashboard. The handler reads durable history instead of live telemetry so the
 * reported values remain stable across server restarts.
 */
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient, getBuggySessionTableName } from "@/lib/supabase/server";
import { PRIVATE_SEMI_STATIC_CACHE_HEADERS } from "@/lib/http/cache";
import { getErrorMessage } from "@/lib/utils/error-message";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_STATISTICS_SESSION_SPEED_KMH = 60;
const MIN_PASSENGER_STABLE_SAMPLES = 3;

type SessionRow = {
  id?: string | null;
  buggy_id?: string | null;
  session_date?: string | null;
  session_number?: number | string | null;
  started_at?: string | null;
  ended_at?: string | null;
  total_distance_km?: number | string | null;
  duration_minutes?: number | string | null;
  avg_speed_kmh?: number | string | null;
  point_count?: number | string | null;
  battery_used?: number | string | null;
  passenger_avg?: number | string | null;
  passenger_peak?: number | string | null;
  passenger_samples?: number | string | null;
  passenger_boardings?: number | string | null;
  path?: unknown;
};

type BuggyCapacityRow = {
  id: string | null;
  capacity: number | string | null;
};

function toNumber(value: number | string | null | undefined): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function calculateTrend(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function getMedian(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

const STATISTICS_SESSION_COLUMNS =
  "id, buggy_id, session_date, session_number, started_at, ended_at, total_distance_km, duration_minutes, avg_speed_kmh, point_count, battery_used, passenger_avg, passenger_peak, passenger_samples, passenger_boardings";
const LEGACY_STATISTICS_SESSION_COLUMNS =
  "id, buggy_id, session_date, session_number, started_at, ended_at, total_distance_km, duration_minutes, avg_speed_kmh, point_count, battery_used, passenger_avg, passenger_peak, passenger_samples, path";

function isSchemaColumnError(message: string): boolean {
  return (
    message.includes("schema cache") ||
    message.includes("Could not find") ||
    message.includes("column")
  );
}

function parsePassengerPath(value: unknown): Array<[number, number, number?, number?]> {
  try {
    const raw = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(raw)) return [];

    return raw.filter(
      (point): point is [number, number, number?, number?] =>
        Array.isArray(point) &&
        typeof point[0] === "number" &&
        typeof point[1] === "number",
    );
  } catch {
    return [];
  }
}

function calculatePassengerBoardingsFromValues(values: number[]): number {
  if (values.length === 0) return 0;

  let boardings = Math.max(0, values[0]);
  let currentOccupancy = values[0];
  let runValue = values[0];
  let runLength = 1;

  for (let index = 1; index <= values.length; index += 1) {
    const value = values[index];
    if (value === runValue) {
      runLength += 1;
      continue;
    }

    if (runLength >= MIN_PASSENGER_STABLE_SAMPLES) {
      boardings += Math.max(0, runValue - currentOccupancy);
      currentOccupancy = runValue;
    }

    if (value === undefined) break;

    runValue = value;
    runLength = 1;
  }

  return boardings;
}

function calculatePassengerBoardingsFromPath(value: unknown): number {
  const values = parsePassengerPath(value)
    .map((point) => point[3])
    .filter((passengers): passengers is number =>
      typeof passengers === "number" && Number.isFinite(passengers) && passengers >= 0,
    );

  return calculatePassengerBoardingsFromValues(values);
}

function getFallbackSessionPassengerLoad(row: SessionRow) {
  return Math.max(0, toNumber(row.passenger_peak) || toNumber(row.passenger_avg));
}

function getEstimatedSessionBoardings(
  row: SessionRow,
  capacityByBuggyId: Map<string, number>,
) {
  const boardings = toNumber(row.passenger_boardings);
  if (boardings > 0) return boardings;

  const pathBoardings = calculatePassengerBoardingsFromPath(row.path);
  if (pathBoardings > 0) return pathBoardings;

  return getBoundedSessionPassengerLoad(row, capacityByBuggyId);
}

function getSessionKey(row: SessionRow): string {
  const buggyId = row.buggy_id ?? "unknown";
  const startedAt = row.started_at ? new Date(row.started_at) : null;
  const date =
    row.session_date ??
    (startedAt && !Number.isNaN(startedAt.getTime())
      ? startedAt.toISOString().slice(0, 10)
      : "unknown");
  const sessionNumber = String(row.session_number ?? "");

  return sessionNumber
    ? `${buggyId}:${date}:${sessionNumber}`
    : `${buggyId}:${row.started_at ?? ""}:${row.ended_at ?? ""}`;
}

function compareSessionQuality(a: SessionRow, b: SessionRow): number {
  const aDistance = toNumber(a.total_distance_km);
  const bDistance = toNumber(b.total_distance_km);
  if (aDistance !== bDistance) return aDistance - bDistance;

  const aPoints = toNumber(a.point_count);
  const bPoints = toNumber(b.point_count);
  if (aPoints !== bPoints) return aPoints - bPoints;

  const aDuration = toNumber(a.duration_minutes);
  const bDuration = toNumber(b.duration_minutes);
  if (aDuration !== bDuration) return aDuration - bDuration;

  const aEndedAt = a.ended_at ? new Date(a.ended_at).getTime() : 0;
  const bEndedAt = b.ended_at ? new Date(b.ended_at).getTime() : 0;
  return (Number.isFinite(aEndedAt) ? aEndedAt : 0) -
    (Number.isFinite(bEndedAt) ? bEndedAt : 0);
}

function dedupeSessions(rows: SessionRow[]): SessionRow[] {
  const byKey = new Map<string, SessionRow>();

  for (const row of rows) {
    const key = getSessionKey(row);
    const existing = byKey.get(key);
    if (!existing || compareSessionQuality(row, existing) > 0) {
      byKey.set(key, row);
    }
  }

  return Array.from(byKey.values());
}

function getImpliedSessionSpeedKmh(row: SessionRow): number {
  const distanceKm = toNumber(row.total_distance_km);
  const durationMinutes = toNumber(row.duration_minutes);

  if (distanceKm <= 0) return 0;
  if (durationMinutes <= 0) return Number.POSITIVE_INFINITY;

  return distanceKm / (durationMinutes / 60);
}

function isStatisticsSessionEligible(row: SessionRow): boolean {
  const impliedSpeedKmh = getImpliedSessionSpeedKmh(row);
  const recordedAvgSpeedKmh = toNumber(row.avg_speed_kmh);

  return (
    impliedSpeedKmh <= MAX_STATISTICS_SESSION_SPEED_KMH &&
    recordedAvgSpeedKmh <= MAX_STATISTICS_SESSION_SPEED_KMH
  );
}

function getCapacityForRow(
  row: SessionRow,
  capacityByBuggyId: Map<string, number>,
): number {
  const capacity =
    row.buggy_id && capacityByBuggyId.has(row.buggy_id)
      ? capacityByBuggyId.get(row.buggy_id)
      : undefined;
  return Math.max(1, capacity ?? 22);
}

function getBoundedSessionPassengerLoad(
  row: SessionRow,
  capacityByBuggyId: Map<string, number>,
): number {
  return Math.min(
    getFallbackSessionPassengerLoad(row),
    getCapacityForRow(row, capacityByBuggyId),
  );
}

function getJakartaHour(value: string | null | undefined): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    hour12: false,
  }).format(date);
  const parsed = Number(hour);
  return Number.isFinite(parsed) ? parsed : null;
}

function getAverageDayDivisor(selectedMonth: Date, currentDate = new Date()) {
  const daysInSelectedMonth = new Date(
    Date.UTC(selectedMonth.getUTCFullYear(), selectedMonth.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const isCurrentMonth =
    selectedMonth.getUTCFullYear() === currentDate.getUTCFullYear() &&
    selectedMonth.getUTCMonth() === currentDate.getUTCMonth();

  if (!isCurrentMonth) return daysInSelectedMonth;

  return Math.min(currentDate.getUTCDate(), daysInSelectedMonth);
}

async function fetchStatisticsRows(
  supabase: SupabaseClient,
  tableName: string,
  startIso: string,
  endIso: string,
) {
  const query = () =>
    supabase
      .from(tableName)
      .select(STATISTICS_SESSION_COLUMNS)
      .gte("started_at", startIso)
      .lte("started_at", endIso);

  const result = await query();
  if (!result.error) return result;

  if (!isSchemaColumnError(result.error.message)) return result;

  return supabase
    .from(tableName)
    .select(LEGACY_STATISTICS_SESSION_COLUMNS)
    .gte("started_at", startIso)
    .lte("started_at", endIso);
}

export async function GET(request: Request) {
  const adminGuard = await requireAdmin();
  if (!adminGuard.authorized) return adminGuard.response;

  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    
    const supabase = createAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const tableName = getBuggySessionTableName();
    const { data: buggyCapacityData, error: buggyCapacityError } = await supabase
      .from("buggies")
      .select("id, capacity");

    if (buggyCapacityError) throw buggyCapacityError;

    const capacityByBuggyId = new Map(
      ((buggyCapacityData ?? []) as BuggyCapacityRow[])
        .filter((row) => typeof row.id === "string" && row.id.length > 0)
        .map((row) => [
          row.id as string,
          Math.max(1, Math.round(toNumber(row.capacity) || 22)),
        ]),
    );

    // Dapatkan awal dan akhir bulan ini berdasarkan parameter date atau bulan saat ini
    const now = dateParam ? new Date(dateParam + "-01T00:00:00Z") : new Date();
    const firstDayOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const lastDayOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999)).toISOString();
    const averageDayDivisor = getAverageDayDivisor(now);

    const { data: currentMonthData, error: currentMonthError } =
      await fetchStatisticsRows(
        supabase,
        tableName,
        firstDayOfMonth,
        lastDayOfMonth,
      );

    if (currentMonthError) throw currentMonthError;

    // Dapatkan data bulan lalu untuk perbandingan (persentase naik/turun)
    const firstDayOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString();
    const lastDayOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999)).toISOString();

    const { data: lastMonthData, error: lastMonthError } =
      await fetchStatisticsRows(
        supabase,
        tableName,
        firstDayOfLastMonth,
        lastDayOfLastMonth,
      );

    if (lastMonthError) throw lastMonthError;

    const dedupedCurrentSessions = dedupeSessions(
      (currentMonthData || []) as SessionRow[],
    );
    const dedupedPreviousSessions = dedupeSessions(
      (lastMonthData || []) as SessionRow[],
    );
    const currentSessions = dedupedCurrentSessions.filter(
      isStatisticsSessionEligible,
    );
    const previousSessions = dedupedPreviousSessions.filter(
      isStatisticsSessionEligible,
    );
    const excludedCurrentOutlierCount =
      dedupedCurrentSessions.length - currentSessions.length;
    const excludedPreviousOutlierCount =
      dedupedPreviousSessions.length - previousSessions.length;

    // --- Kalkulasi Data Bulan Ini ---
    let totalDistanceKm = 0;
    let totalDurationMin = 0;
    let totalSpeed = 0;
    let speedCount = 0;
    let totalPassengers = 0;
    let totalBatteryUsed = 0;
    let batteryUsedCount = 0;

    const tripsThisMonth = currentSessions.length;

    for (const row of currentSessions) {
      totalDistanceKm += toNumber(row.total_distance_km);
      totalDurationMin += toNumber(row.duration_minutes);
      const batteryUsed = toNumber(row.battery_used);
      if (batteryUsed > 0) {
        totalBatteryUsed += batteryUsed;
        batteryUsedCount++;
      }
      const avgSpeed = toNumber(row.avg_speed_kmh);
      if (avgSpeed > 0) {
        totalSpeed += avgSpeed;
        speedCount++;
      }
      totalPassengers += getEstimatedSessionBoardings(row, capacityByBuggyId);
    }

    const avgSpeedThisMonth = speedCount > 0 ? totalSpeed / speedCount : 0;
    const avgBatteryUsedThisMonth =
      batteryUsedCount > 0 ? totalBatteryUsed / batteryUsedCount : null;

    // --- Kalkulasi Data Bulan Lalu ---
    let totalDistanceLastMonth = 0;
    let totalPassengersLastMonth = 0;
    const tripsLastMonth = previousSessions.length;

    for (const row of previousSessions) {
      totalDistanceLastMonth += toNumber(row.total_distance_km);
      totalPassengersLastMonth += getEstimatedSessionBoardings(
        row,
        capacityByBuggyId,
      );
    }

    const distanceTrend = calculateTrend(totalDistanceKm, totalDistanceLastMonth);
    const tripsTrend = calculateTrend(tripsThisMonth, tripsLastMonth);
    const passengersTrend = calculateTrend(
      totalPassengers,
      totalPassengersLastMonth,
    );
    
    const dailyMap = new Map<
      string,
      { date: string; trips: number; distanceKm: number; durationMin: number }
    >();
    const buggyMap = new Map<
      string,
      { buggyId: string; trips: number; distanceKm: number; durationMin: number }
    >();

    for (const row of currentSessions) {
      const startedAt = row.started_at ? new Date(row.started_at) : null;
      const dayKey =
        startedAt && !Number.isNaN(startedAt.getTime())
          ? startedAt.toISOString().slice(0, 10)
          : "unknown";
      const daily = dailyMap.get(dayKey) ?? {
        date: dayKey,
        trips: 0,
        distanceKm: 0,
        durationMin: 0,
      };
      daily.trips += 1;
      daily.distanceKm += toNumber(row.total_distance_km);
      daily.durationMin += toNumber(row.duration_minutes);
      dailyMap.set(dayKey, daily);

      const buggyId = row.buggy_id ?? "unknown";
      const buggy = buggyMap.get(buggyId) ?? {
        buggyId,
        trips: 0,
        distanceKm: 0,
        durationMin: 0,
      };
      buggy.trips += 1;
      buggy.distanceKm += toNumber(row.total_distance_km);
      buggy.durationMin += toNumber(row.duration_minutes);
      buggyMap.set(buggyId, buggy);
    }

    const dailySeries = Array.from(dailyMap.values())
      .filter((item) => item.date !== "unknown")
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((item) => ({
        ...item,
        distanceKm: Number(item.distanceKm.toFixed(1)),
        durationMin: Math.round(item.durationMin),
      }));
    const topBuggies = Array.from(buggyMap.values())
      .sort((a, b) => b.distanceKm - a.distanceKm)
      .slice(0, 5)
      .map((item) => ({
        ...item,
        distanceKm: Number(item.distanceKm.toFixed(1)),
        durationMin: Math.round(item.durationMin),
      }));
    const hourlyPassengerDemand = Array.from({ length: 24 }, (_, hour) => ({
      label: `${String(hour).padStart(2, "0")}:00`,
      value: 0,
    }));
    const durationValues = currentSessions
      .map((row) => toNumber(row.duration_minutes))
      .filter((duration) => duration > 0);
    const typicalDuration = getMedian(durationValues);
    const targetDuration = typicalDuration > 0 ? typicalDuration * 1.15 : 0;
    const delayTrend = Array.from({ length: 24 }, (_, hour) => ({
      label: `${String(hour).padStart(2, "0")}:00`,
      value: 0,
    }));

    const hourlyPassengerByBuggy = Array.from(
      { length: 24 },
      () => new Map<string, number>(),
    );

    for (const row of currentSessions) {
      const hour = getJakartaHour(row.started_at);
      if (hour === null) continue;

      const buggyId = row.buggy_id ?? "unknown";
      const boundedLoad = getBoundedSessionPassengerLoad(row, capacityByBuggyId);
      const currentHourlyLoad = hourlyPassengerByBuggy[hour].get(buggyId) ?? 0;
      hourlyPassengerByBuggy[hour].set(
        buggyId,
        Math.max(currentHourlyLoad, boundedLoad),
      );

      const duration = toNumber(row.duration_minutes);
      if (targetDuration > 0 && duration > targetDuration) {
        delayTrend[hour].value += duration - targetDuration;
      }
    }

    hourlyPassengerByBuggy.forEach((loadsByBuggy, hour) => {
      hourlyPassengerDemand[hour].value = Array.from(loadsByBuggy.values())
        .reduce((sum, value) => sum + value, 0);
    });

    return NextResponse.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        currentMonth: {
          totalTrips: tripsThisMonth,
          totalDistanceKm: Number(totalDistanceKm.toFixed(1)),
          avgSpeedKmh: Number(avgSpeedThisMonth.toFixed(1)),
          totalDurationMin: Math.round(totalDurationMin),
          totalPassengers: Math.round(totalPassengers),
          avgBatteryUsed:
            avgBatteryUsedThisMonth !== null
              ? Number(avgBatteryUsedThisMonth.toFixed(1))
              : null,
          avgPassengersPerDay: Number(
            (totalPassengers / Math.max(1, averageDayDivisor)).toFixed(1),
          ),
        },
        trends: {
          trips: Number(tripsTrend.toFixed(1)),
          distance: Number(distanceTrend.toFixed(1)),
          passengers: Number(passengersTrend.toFixed(1)),
        },
        dataQuality: {
          passengerMetric: "estimated_boardings_from_positive_occupancy_delta",
          passengerNote:
            "Total passengers adalah estimasi penumpang naik per sesi: nilai penumpang awal ditambah kenaikan positif occupancy yang stabil minimal 3 sampel GPS. Jika kolom passenger_boardings belum tersedia pada data lama, sistem fallback ke perhitungan dari path atau passenger_peak/passenger_avg.",
          maxSessionSpeedKmh: MAX_STATISTICS_SESSION_SPEED_KMH,
          excludedCurrentOutlierSessions: excludedCurrentOutlierCount,
          excludedPreviousOutlierSessions: excludedPreviousOutlierCount,
          distanceNote:
            "Statistik jarak mengabaikan sesi dengan kecepatan implisit tidak realistis agar GPS jump historis tidak mencemari agregat bulanan.",
        },
        dailySeries,
        topBuggies,
        hourlyPassengerDemand: hourlyPassengerDemand.map((item) => ({
          ...item,
          value: Math.round(item.value),
        })),
        delayTrend: {
          targetDuration: Number(targetDuration.toFixed(1)),
          data: delayTrend.map((item) => ({
            ...item,
            value: Number(item.value.toFixed(1)),
          })),
        },
      }
    }, {
      headers: PRIVATE_SEMI_STATIC_CACHE_HEADERS,
    });

  } catch (err) {
    console.error("Error fetching statistics:", err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
