import { NextResponse } from "next/server";
import { createAdminClient, getBuggySessionTableName } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
      .select("total_distance_km, duration_minutes, avg_speed_kmh, point_count")
      .gte("started_at", firstDayOfMonth)
      .lte("started_at", lastDayOfMonth);

    if (currentMonthError) throw currentMonthError;

    // Dapatkan data bulan lalu untuk perbandingan (persentase naik/turun)
    const firstDayOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString();
    const lastDayOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999)).toISOString();

    const { data: lastMonthData, error: lastMonthError } = await supabase
      .from(tableName)
      .select("total_distance_km, duration_minutes")
      .gte("started_at", firstDayOfLastMonth)
      .lte("started_at", lastDayOfLastMonth);

    if (lastMonthError) throw lastMonthError;

    // --- Kalkulasi Data Bulan Ini ---
    let totalDistanceKm = 0;
    let totalDurationMin = 0;
    let totalSpeed = 0;
    let speedCount = 0;

    const tripsThisMonth = currentMonthData?.length || 0;

    for (const row of currentMonthData || []) {
      totalDistanceKm += Number(row.total_distance_km || 0);
      totalDurationMin += Number(row.duration_minutes || 0);
      if (row.avg_speed_kmh && row.avg_speed_kmh > 0) {
        totalSpeed += Number(row.avg_speed_kmh);
        speedCount++;
      }
    }

    const avgSpeedThisMonth = speedCount > 0 ? totalSpeed / speedCount : 0;

    // --- Kalkulasi Data Bulan Lalu ---
    let totalDistanceLastMonth = 0;
    const tripsLastMonth = lastMonthData?.length || 0;

    for (const row of lastMonthData || []) {
      totalDistanceLastMonth += Number(row.total_distance_km || 0);
    }

    // --- Hitung Persentase Perubahan ---
    const calculateTrend = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    const distanceTrend = calculateTrend(totalDistanceKm, totalDistanceLastMonth);
    const tripsTrend = calculateTrend(tripsThisMonth, tripsLastMonth);

    // --- Opsi A: Mock Data untuk Penumpang ---
    // Karena kita tidak merekam penumpang historis, kita generate data yang terlihat masuk akal
    // berdasarkan jumlah perjalanan (misal: rata-rata 5 penumpang per perjalanan)
    const mockTotalPassengers = tripsThisMonth * 5 + Math.floor(Math.random() * 20);
    const mockPassengersLastMonth = tripsLastMonth * 5 + Math.floor(Math.random() * 20);
    const passengerTrend = calculateTrend(mockTotalPassengers, mockPassengersLastMonth);
    
    // Asumsi: hari berlalu di bulan ini
    let daysPassed = 30;
    if (dateParam) {
      const today = new Date();
      if (now.getUTCFullYear() === today.getUTCFullYear() && now.getUTCMonth() === today.getUTCMonth()) {
         daysPassed = Math.max(1, today.getUTCDate());
      } else {
         daysPassed = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
      }
    } else {
       daysPassed = Math.max(1, new Date().getUTCDate());
    }
    const mockAvgPassengersPerDay = Math.round(mockTotalPassengers / daysPassed);

    return NextResponse.json({
      success: true,
      data: {
        currentMonth: {
          totalTrips: tripsThisMonth,
          totalDistanceKm: Number(totalDistanceKm.toFixed(1)),
          avgSpeedKmh: Number(avgSpeedThisMonth.toFixed(1)),
          totalDurationMin: Math.round(totalDurationMin),
          totalPassengers: mockTotalPassengers,
          avgPassengersPerDay: mockAvgPassengersPerDay,
        },
        trends: {
          trips: Number(tripsTrend.toFixed(1)),
          distance: Number(distanceTrend.toFixed(1)),
          passengers: Number(passengerTrend.toFixed(1)),
        }
      }
    });

  } catch (err: any) {
    console.error("Error fetching statistics:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
