/**
 * Admin operational statistics API.
 *
 * Aggregates completed session rows into monthly fleet metrics for the admin
 * dashboard. The handler reads durable history instead of live telemetry so the
 * reported values remain stable across server restarts.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient, getBuggySessionTableName } from "@/lib/supabase/server";
import { PRIVATE_SEMI_STATIC_CACHE_HEADERS } from "@/lib/http/cache";
import { getErrorMessage } from "@/lib/utils/error-message";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SessionRow = {
  buggy_id?: string | null;
  started_at?: string | null;
  total_distance_km?: number | string | null;
  duration_minutes?: number | string | null;
  avg_speed_kmh?: number | string | null;
  point_count?: number | string | null;
  passenger_avg?: number | string | null;
  passenger_peak?: number | string | null;
  passenger_samples?: number | string | null;
};

function toNumber(value: number | string | null | undefined): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function calculateTrend(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
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

    // Dapatkan awal dan akhir bulan ini berdasarkan parameter date atau bulan saat ini
    const now = dateParam ? new Date(dateParam + "-01T00:00:00Z") : new Date();
    const firstDayOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const lastDayOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999)).toISOString();

    const { data: currentMonthData, error: currentMonthError } = await supabase
      .from(tableName)
      .select("buggy_id, started_at, total_distance_km, duration_minutes, avg_speed_kmh, point_count, passenger_avg, passenger_peak, passenger_samples")
      .gte("started_at", firstDayOfMonth)
      .lte("started_at", lastDayOfMonth);

    if (currentMonthError) throw currentMonthError;

    // Dapatkan data bulan lalu untuk perbandingan (persentase naik/turun)
    const firstDayOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString();
    const lastDayOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999)).toISOString();

    const { data: lastMonthData, error: lastMonthError } = await supabase
      .from(tableName)
      .select("buggy_id, started_at, total_distance_km, duration_minutes, avg_speed_kmh, point_count, passenger_avg, passenger_peak, passenger_samples")
      .gte("started_at", firstDayOfLastMonth)
      .lte("started_at", lastDayOfLastMonth);

    if (lastMonthError) throw lastMonthError;

    // --- Kalkulasi Data Bulan Ini ---
    let totalDistanceKm = 0;
    let totalDurationMin = 0;
    let totalSpeed = 0;
    let speedCount = 0;
    let totalPassengers = 0;

    const tripsThisMonth = currentMonthData?.length || 0;

    for (const row of (currentMonthData || []) as SessionRow[]) {
      totalDistanceKm += toNumber(row.total_distance_km);
      totalDurationMin += toNumber(row.duration_minutes);
      const avgSpeed = toNumber(row.avg_speed_kmh);
      if (avgSpeed > 0) {
        totalSpeed += avgSpeed;
        speedCount++;
      }
      totalPassengers += Math.max(
        0,
        toNumber(row.passenger_peak) || toNumber(row.passenger_avg),
      );
    }

    const avgSpeedThisMonth = speedCount > 0 ? totalSpeed / speedCount : 0;

    // --- Kalkulasi Data Bulan Lalu ---
    let totalDistanceLastMonth = 0;
    let totalPassengersLastMonth = 0;
    const tripsLastMonth = lastMonthData?.length || 0;

    for (const row of (lastMonthData || []) as SessionRow[]) {
      totalDistanceLastMonth += toNumber(row.total_distance_km);
      totalPassengersLastMonth += Math.max(
        0,
        toNumber(row.passenger_peak) || toNumber(row.passenger_avg),
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

    for (const row of (currentMonthData || []) as SessionRow[]) {
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
          avgPassengersPerDay: Number(
            (totalPassengers / Math.max(1, new Date().getUTCDate())).toFixed(1),
          ),
        },
        trends: {
          trips: Number(tripsTrend.toFixed(1)),
          distance: Number(distanceTrend.toFixed(1)),
          passengers: Number(passengersTrend.toFixed(1)),
        },
        dataQuality: {
          passengerMetric: "session_summary",
          passengerNote:
            "Data penumpang dihitung dari passenger_peak/passenger_avg pada ringkasan sesi.",
        },
        dailySeries,
        topBuggies,
      }
    }, {
      headers: PRIVATE_SEMI_STATIC_CACHE_HEADERS,
    });

  } catch (err) {
    console.error("Error fetching statistics:", err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
