import { NextResponse } from "next/server";
import { createAdminClient, getBuggySessionTableName } from "@/lib/supabase/server";
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
      .select("buggy_id, started_at, total_distance_km, duration_minutes, avg_speed_kmh, point_count")
      .gte("started_at", firstDayOfMonth)
      .lte("started_at", lastDayOfMonth);

    if (currentMonthError) throw currentMonthError;

    // Dapatkan data bulan lalu untuk perbandingan (persentase naik/turun)
    const firstDayOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString();
    const lastDayOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999)).toISOString();

    const { data: lastMonthData, error: lastMonthError } = await supabase
      .from(tableName)
      .select("buggy_id, started_at, total_distance_km, duration_minutes, avg_speed_kmh, point_count")
      .gte("started_at", firstDayOfLastMonth)
      .lte("started_at", lastDayOfLastMonth);

    if (lastMonthError) throw lastMonthError;

    // --- Kalkulasi Data Bulan Ini ---
    let totalDistanceKm = 0;
    let totalDurationMin = 0;
    let totalSpeed = 0;
    let speedCount = 0;

    const tripsThisMonth = currentMonthData?.length || 0;

    for (const row of (currentMonthData || []) as SessionRow[]) {
      totalDistanceKm += toNumber(row.total_distance_km);
      totalDurationMin += toNumber(row.duration_minutes);
      const avgSpeed = toNumber(row.avg_speed_kmh);
      if (avgSpeed > 0) {
        totalSpeed += avgSpeed;
        speedCount++;
      }
    }

    const avgSpeedThisMonth = speedCount > 0 ? totalSpeed / speedCount : 0;

    // --- Kalkulasi Data Bulan Lalu ---
    let totalDistanceLastMonth = 0;
    const tripsLastMonth = lastMonthData?.length || 0;

    for (const row of (lastMonthData || []) as SessionRow[]) {
      totalDistanceLastMonth += toNumber(row.total_distance_km);
    }

    const distanceTrend = calculateTrend(totalDistanceKm, totalDistanceLastMonth);
    const tripsTrend = calculateTrend(tripsThisMonth, tripsLastMonth);
    
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
          totalPassengers: null,
          avgPassengersPerDay: null,
        },
        trends: {
          trips: Number(tripsTrend.toFixed(1)),
          distance: Number(distanceTrend.toFixed(1)),
          passengers: null,
        },
        dataQuality: {
          passengerMetric: "unavailable",
          passengerNote:
            "Data penumpang historis belum direkam di sesi, sehingga metrik penumpang tidak diestimasi.",
        },
        dailySeries,
        topBuggies,
      }
    });

  } catch (err) {
    console.error("Error fetching statistics:", err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
