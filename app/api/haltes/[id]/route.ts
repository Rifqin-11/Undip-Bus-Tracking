import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { setHalteLocations, getHalteLocations } from "@/lib/transit/halte-runtime";
import type { HaltePoint } from "@/types/buggy";

export const runtime = "nodejs";

type HalteRow = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  sort_order: number;
  is_active: boolean;
};

/** Reload halte runtime from DB after any mutation */
async function reloadHalteRuntime() {
  const supabase = createAdminClient();
  if (!supabase) return;

  const { data } = await supabase
    .from("haltes")
    .select("id, name, lat, lng, sort_order, is_active")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (data && data.length > 0) {
    const haltes: HaltePoint[] = (data as HalteRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      lat: row.lat,
      lng: row.lng,
    }));
    setHalteLocations(haltes);
  }
}

/** PUT /api/haltes/[id] — update halte */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, lat, lng, sort_order, is_active } = body;

    const supabase = createAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase admin belum dikonfigurasi" }, { status: 500 });
    }

    const { data, error } = await supabase
      .from("haltes")
      .update({
        ...(name !== undefined && { name }),
        ...(lat !== undefined && { lat }),
        ...(lng !== undefined && { lng }),
        ...(sort_order !== undefined && { sort_order }),
        ...(is_active !== undefined && { is_active }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Reload runtime halte agar perubahan langsung tersedia
    await reloadHalteRuntime();

    return NextResponse.json({ success: true, halte: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** DELETE /api/haltes/[id] — hapus halte */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const supabase = createAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase admin belum dikonfigurasi" }, { status: 500 });
    }

    const { error } = await supabase
      .from("haltes")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Hapus dari runtime
    const updated = getHalteLocations().filter((h) => h.id !== id);
    setHalteLocations(updated);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
