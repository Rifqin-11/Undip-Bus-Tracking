/**
 * Admin announcement creation API.
 *
 * Accepts announcement content from the admin dashboard and persists it to
 * Supabase. Public clients read active announcements through `/api/announcements`.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const adminGuard = await requireAdmin();
  if (!adminGuard.authorized) return adminGuard.response;

  try {
    const body = await request.json();
    const { title, content, type = "info", is_active = true } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: "Title and content are required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("announcements")
      .insert([
        {
          title,
          content,
          type,
          is_active,
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
