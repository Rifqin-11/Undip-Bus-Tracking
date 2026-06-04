/**
 * Admin fleet item API.
 *
 * Updates, hides, or deletes one buggy. The route also synchronizes the in-memory
 * live store because fleet visibility affects the real-time map immediately.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/server";
import {
  adminAddBuggyToStore,
  adminUpdateBuggyInStore,
  adminRemoveBuggyFromStore,
} from "@/lib/realtime/buggy-live-store";
import { getHalteLocations } from "@/lib/transit/halte-runtime";
import { CENTER_UNDIP } from "@/lib/transit/buggy-data";
import { getErrorMessage } from "@/lib/utils/error-message";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminGuard = await requireAdmin();
  if (!adminGuard.authorized) return adminGuard.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const { code, name, capacity, isActive } = body;

    if (!id || typeof capacity !== "number" || typeof name !== "string" || typeof code !== "string") {
      return NextResponse.json({ error: "Data payload invalid" }, { status: 400 });
    }

    const supabase = createAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: "Fungsi Supabase Admin belum dikonfigurasi" }, { status: 500 });
    }

    const { data, error } = await supabase
      .from("buggies")
      .update({
        code,
        name,
        capacity,
        is_active: isActive ?? true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Supabase update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (data.is_active === false) {
      adminRemoveBuggyFromStore(id);
    } else {
      const lat = CENTER_UNDIP[0];
      const lng = CENTER_UNDIP[1];
      adminAddBuggyToStore({
        id: data.id,
        numericId: data.numeric_id ?? undefined,
        code: data.code,
        name: data.name,
        isActive: false,
        routeLabel: "Rute Kampus Undip",
        tripId: `TRIP-2026-${data.code}`,
        etaMinutes: 5,
        speedKmh: 0,
        crowdLevel: "LONGGAR",
        passengers: 0,
        capacity: data.capacity,
        tag: "GPS Nyata",
        updatedAt: "--:--",
        connectionStatus: "offline",
        currentStopIndex: 0,
        stops: getHalteLocations().map((halte) => halte.name),
        pathCursor: 0,
        position: { lat, lng },
      });
      adminUpdateBuggyInStore(id, {
        numericId: data.numeric_id ?? undefined,
        code: data.code,
        name: data.name,
        capacity: data.capacity,
      });
    }

    return NextResponse.json({ success: true, buggy: data });
  } catch (err) {
    console.error("Error updating buggy:", err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}

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
      return NextResponse.json({ error: "Fungsi Supabase Admin belum dikonfigurasi" }, { status: 500 });
    }

    const { error } = await supabase
      .from("buggies")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Supabase delete error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Remove from live system memory store
    adminRemoveBuggyFromStore(id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error deleting buggy:", err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
