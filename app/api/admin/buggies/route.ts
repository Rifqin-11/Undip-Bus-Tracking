import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { adminAddBuggyToStore } from "@/lib/realtime/buggy-live-store";
import { CENTER_UNDIP, HALTE_LOCATIONS } from "@/lib/transit/buggy-data";

export async function POST(request: Request) {
  try {
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
      tag: "Real GPS",
      updatedAt: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      currentStopIndex: 0,
      stops: HALTE_LOCATIONS.map(h => h.name),
      pathCursor: 0,
      position: { lat, lng }
    };

    // 3. Masukkan ke Memory Live Tracking agar langsung muncul tanpa reset Server
    adminAddBuggyToStore(newBuggy);

    return NextResponse.json({ success: true, buggy: newBuggy });
  } catch (err: any) {
    console.error("Error creating buggy:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
