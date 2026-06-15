/**
 * Halte item API.
 *
 * Updates or deletes one campus stop, then reloads the runtime halte cache so
 * route search, maps, and admin tables stay consistent after mutation.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/server";
import { setHalteLocations, getHalteLocations } from "@/lib/transit/halte-runtime";
import type { HaltePoint } from "@/types/buggy";
import { getErrorMessage } from "@/lib/utils/error-message";

export const runtime = "nodejs";

type HalteRow = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  sort_order: number;
  is_active: boolean;
  is_optional: boolean;
  schedule: string[] | null;
  facilities: string[] | null;
};

/** Reload halte runtime from DB after any mutation */
async function reloadHalteRuntime() {
  const supabase = createAdminClient();
  if (!supabase) return;

  const { data } = await supabase
    .from("haltes")
    .select("id, name, lat, lng, sort_order, is_active, is_optional, schedule, facilities")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (data && data.length > 0) {
    const haltes: HaltePoint[] = (data as HalteRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      lat: row.lat,
      lng: row.lng,
      schedule: Array.isArray(row.schedule) ? row.schedule : undefined,
      facilities: Array.isArray(row.facilities) ? row.facilities : undefined,
      isActive: row.is_active,
      isOptional: row.is_optional,
      sortOrder: row.sort_order,
    }));
    setHalteLocations(haltes);
  }
}

/** PUT /api/haltes/[id] — update halte */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminGuard = await requireAdmin();
  if (!adminGuard.authorized) return adminGuard.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const {
      name,
      lat,
      lng,
      sort_order,
      is_active,
      is_optional,
      schedule,
      facilities,
    } = body;

    const supabase = createAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase admin belum dikonfigurasi" }, { status: 500 });
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updatePayload.name = name;
    if (lat !== undefined) updatePayload.lat = lat;
    if (lng !== undefined) updatePayload.lng = lng;
    if (sort_order !== undefined) updatePayload.sort_order = sort_order;
    if (is_active !== undefined) updatePayload.is_active = is_active;
    if (is_optional !== undefined) updatePayload.is_optional = is_optional;
    if (schedule !== undefined) updatePayload.schedule = Array.isArray(schedule) ? schedule : null;
    if (facilities !== undefined) updatePayload.facilities = Array.isArray(facilities) ? facilities : null;

    const { data, error } = await supabase
      .from("haltes")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Reload runtime halte agar perubahan langsung tersedia
    await reloadHalteRuntime();

    return NextResponse.json({ success: true, halte: data });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}

/** DELETE /api/haltes/[id] — hapus halte */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminGuard = await requireAdmin();
  if (!adminGuard.authorized) return adminGuard.response;

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
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
