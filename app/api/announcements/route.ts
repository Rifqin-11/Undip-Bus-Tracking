/**
 * Public announcement API.
 *
 * Returns active announcements for the dashboard. This route intentionally has
 * no write operations; content management lives under `/api/admin/announcements`.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const url = new URL(request.url);
    const activeOnly = url.searchParams.get("active") !== "false";

    let query = supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });

    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
