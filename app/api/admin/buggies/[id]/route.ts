import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { adminUpdateBuggyInStore, adminRemoveBuggyFromStore } from "@/lib/realtime/buggy-live-store";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Update the live system memory store
    adminUpdateBuggyInStore(id, {
      code: data.code,
      name: data.name,
      capacity: data.capacity,
      isActive: data.is_active,
    });

    return NextResponse.json({ success: true, buggy: data });
  } catch (err: any) {
    console.error("Error updating buggy:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
  } catch (err: any) {
    console.error("Error deleting buggy:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
