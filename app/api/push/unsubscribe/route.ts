/**
 * Web Push unsubscribe API.
 *
 * Removes a browser endpoint from Supabase when the user disables notifications
 * or the browser subscription becomes invalid.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      {
        error:
          "Supabase admin env belum lengkap. Set NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY.",
      },
      { status: 500 },
    );
  }

  let body: { endpoint?: unknown };
  try {
    body = (await request.json()) as { endpoint?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body.endpoint !== "string") {
    return NextResponse.json(
      { error: "Endpoint subscription wajib dikirim." },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("notification_subscriptions")
    .delete()
    .eq("endpoint", body.endpoint);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
