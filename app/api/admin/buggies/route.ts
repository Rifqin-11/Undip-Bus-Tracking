/**
 * Admin fleet collection API.
 *
 * Creates and lists buggy master data. New fleets are inserted into Supabase and
 * mirrored into the process-local live store so the dashboard reflects changes
 * without waiting for the next GPS packet.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/server";
import { adminAddBuggyToStore } from "@/lib/realtime/buggy-live-store";
import { getHalteLocations } from "@/lib/transit/halte-runtime";
import { bootstrapFromDatabase } from "@/lib/supabase/data-loader";
import { mergeLatestBuggyTelemetry } from "@/lib/supabase/latest-buggy-telemetry";
import { CENTER_UNDIP } from "@/lib/transit/buggy-data";
import { getErrorMessage } from "@/lib/utils/error-message";
import { fmtTime } from "@/lib/utils/format-time";
import type { Buggy } from "@/types/buggy";

type BuggyRow = {
  id: string;
  code: string;
  name: string;
  capacity: number;
  is_active: boolean;
  numeric_id: number | null;
};

function mapBuggyRow(row: BuggyRow): Buggy {
  const lat = CENTER_UNDIP[0];
  const lng = CENTER_UNDIP[1];

  return {
    id: row.id,
    numericId: row.numeric_id ?? undefined,
    code: row.code,
    name: row.name,
    isActive: row.is_active,
    routeLabel: "Rute Kampus Undip",
    tripId: `TRIP-2026-${row.code}`,
    etaMinutes: 5,
    speedKmh: 0,
    crowdLevel: "LONGGAR",
    passengers: 0,
    capacity: row.capacity,
    tag: "GPS Nyata",
    updatedAt: "--:--",
    connectionStatus: "offline",
    currentStopIndex: 0,
    stops: getHalteLocations().map((halte) => halte.name),
    pathCursor: 0,
    position: { lat, lng },
  };
}

export async function GET() {
  const adminGuard = await requireAdmin();
  if (!adminGuard.authorized) return adminGuard.response;

  try {
    const supabase = createAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Fungsi Supabase Admin belum dikonfigurasi" },
        { status: 500 },
      );
    }

    const { data, error } = await supabase
      .from("buggies")
      .select("id, code, name, capacity, is_active, numeric_id")
      .order("code", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const buggies = ((data ?? []) as BuggyRow[]).map(mapBuggyRow);
    const merged = await mergeLatestBuggyTelemetry(buggies);
    return NextResponse.json({ buggies: merged.buggies });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const adminGuard = await requireAdmin();
  if (!adminGuard.authorized) return adminGuard.response;

  try {
    // Pastikan halte runtime sudah diisi dari DB sebelum membuat buggy baru
    await bootstrapFromDatabase();

    const body = await request.json();
    const { code, name, capacity, isActive = true } = body;

    if (!code || !name || typeof capacity !== "number") {
      return NextResponse.json({ error: "Data buggy tidak lengkap atau valid" }, { status: 400 });
    }

    const supabase = createAdminClient();
    
    if (!supabase) {
      return NextResponse.json({ error: "Fungsi Supabase Admin belum dikonfigurasi" }, { status: 500 });
    }

    // 1. Insert ke tabel buggies Supabase
    const { data, error } = await supabase
      .from("buggies")
      .insert({
        code,
        name,
        capacity,
        is_active: isActive,
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 2. Format dan inisiasi objek `Buggy` asli untuk Tracking
    const lat = CENTER_UNDIP[0];
    const lng = CENTER_UNDIP[1];
    
    const newBuggy = {
      id: data.id,
      code: data.code,
      name: data.name,
      isActive: data.is_active,
      routeLabel: "Rute Kampus Undip",
      tripId: `TRIP-2026-${data.code}`,
      etaMinutes: 5,
      speedKmh: 0,
      crowdLevel: "LONGGAR" as const,
      passengers: 0,
      capacity: data.capacity,
      tag: "GPS Nyata",
      updatedAt: fmtTime(new Date().toISOString()),
      currentStopIndex: 0,
      stops: getHalteLocations().map(h => h.name),
      pathCursor: 0,
      position: { lat, lng }
    };

    // 3. Masukkan ke Memory Live Tracking agar langsung muncul tanpa reset Server
    adminAddBuggyToStore(newBuggy);

    return NextResponse.json({ success: true, buggy: newBuggy });
  } catch (err) {
    console.error("Error creating buggy:", err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
