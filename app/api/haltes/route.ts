import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getHalteLocations } from "@/lib/transit/halte-runtime";
import { bootstrapFromDatabase } from "@/lib/supabase/data-loader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/haltes — returns the current runtime halte list */
export async function GET() {
  await bootstrapFromDatabase();
  return NextResponse.json(getHalteLocations());
}

/** POST /api/haltes — tambah halte baru (admin only) */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, name, lat, lng, sort_order } = body;

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
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, halte: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
