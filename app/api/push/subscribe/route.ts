import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PushSubscribeBody = {
  subscription?: {
    endpoint?: unknown;
    keys?: {
      p256dh?: unknown;
      auth?: unknown;
    };
  };
  userPosition?: {
    lat?: unknown;
    lng?: unknown;
  } | null;
  nearbyAlertRadiusMeters?: unknown;
};

function clampAlertRadius(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 150;
  return Math.max(50, Math.min(1000, Math.round(value)));
}

function normalizePosition(position: PushSubscribeBody["userPosition"]) {
  if (
    !position ||
    typeof position.lat !== "number" ||
    typeof position.lng !== "number" ||
    !Number.isFinite(position.lat) ||
    !Number.isFinite(position.lng) ||
    position.lat < -90 ||
    position.lat > 90 ||
    position.lng < -180 ||
    position.lng > 180
  ) {
    return { user_lat: null, user_lng: null };
  }

  return {
    user_lat: position.lat,
    user_lng: position.lng,
  };
}

async function getOptionalUserId() {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

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

  let body: PushSubscribeBody;
  try {
    body = (await request.json()) as PushSubscribeBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const endpoint = body.subscription?.endpoint;
  const p256dh = body.subscription?.keys?.p256dh;
  const auth = body.subscription?.keys?.auth;

  if (
    typeof endpoint !== "string" ||
    typeof p256dh !== "string" ||
    typeof auth !== "string"
  ) {
    return NextResponse.json(
      { error: "Subscription endpoint, p256dh, dan auth wajib dikirim." },
      { status: 400 },
    );
  }

  const position = normalizePosition(body.userPosition);
  const userId = await getOptionalUserId();
  const { error } = await supabase.from("notification_subscriptions").upsert(
    {
      endpoint,
      p256dh,
      auth,
      user_id: userId,
      user_agent: request.headers.get("user-agent"),
      nearby_radius_meters: clampAlertRadius(body.nearbyAlertRadiusMeters),
      ...position,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
