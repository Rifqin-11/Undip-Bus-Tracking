import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getHalteLocations, setHalteLocations } from "@/lib/transit/halte-runtime";
import { bootstrapFromDatabase } from "@/lib/supabase/data-loader";
import type { HaltePoint } from "@/types/buggy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/haltes — returns the current runtime halte list (enriched from DB) */
export async function GET() {
  await bootstrapFromDatabase();

  // Ambil langsung dari DB supaya admin selalu dapat data terbaru (termasuk is_active false)
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(getHalteLocations());
  }

  const { data, error } = await supabase
    .from("haltes")
    .select("id, name, lat, lng, sort_order, is_active, schedule, facilities")
    .order("sort_order", { ascending: true });

  if (error || !data) {
    return NextResponse.json(getHalteLocations());
  }

  type HalteRow = {
    id: string;
    name: string;
    lat: number;
    lng: number;
    sort_order: number;
    is_active: boolean;
    schedule: string[] | null;
    facilities: string[] | null;
  };

  const haltes: HaltePoint[] = (data as HalteRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    lat: row.lat,
    lng: row.lng,
    schedule: Array.isArray(row.schedule) ? row.schedule : undefined,
    facilities: Array.isArray(row.facilities) ? row.facilities : undefined,
    isActive: row.is_active,
  }));

  return NextResponse.json(haltes);
}

/** POST /api/haltes — tambah halte baru (admin only) */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, name, lat, lng, sort_order, schedule, facilities, is_active } = body;

    if (!id || !name || typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json({ error: "Data halte tidak lengkap" }, { status: 400 });
    }

    const supabase = createAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase admin belum dikonfigurasi" }, { status: 500 });
    }

    const { data, error } = await supabase
      .from("haltes")
      .insert({
        id,
        name,
        lat,
        lng,
        sort_order: sort_order ?? 99,
        is_active: is_active !== false,
        schedule: Array.isArray(schedule) ? schedule : null,
        facilities: Array.isArray(facilities) ? facilities : null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Reload runtime
    await reloadHalteRuntime();

    return NextResponse.json({ success: true, halte: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** Reload halte runtime dari DB setelah mutasi */
async function reloadHalteRuntime() {
  const supabase = createAdminClient();
  if (!supabase) return;

  const { data } = await supabase
    .from("haltes")
    .select("id, name, lat, lng, sort_order, is_active, schedule, facilities")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (data && data.length > 0) {
    type HalteRow = {
      id: string; name: string; lat: number; lng: number;
      sort_order: number; is_active: boolean;
      schedule: string[] | null; facilities: string[] | null;
    };
    const haltes: HaltePoint[] = (data as HalteRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      lat: row.lat,
      lng: row.lng,
      schedule: Array.isArray(row.schedule) ? row.schedule : undefined,
      facilities: Array.isArray(row.facilities) ? row.facilities : undefined,
      isActive: row.is_active,
    }));
    setHalteLocations(haltes);
  }
}
