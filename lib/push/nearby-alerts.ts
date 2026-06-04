/**
 * Server-side nearby-buggy push alert worker.
 *
 * Evaluates stored browser subscriptions against the live fleet snapshot and
 * sends Web Push notifications with per-endpoint cooldown protection.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBuggyLiveSnapshot } from "@/lib/realtime/buggy-live-store";
import { bootstrapFromDatabase } from "@/lib/supabase/data-loader";
import { mergeLatestBuggyTelemetry } from "@/lib/supabase/latest-buggy-telemetry";
import { createAdminClient } from "@/lib/supabase/server";
import { getHalteLocations } from "@/lib/transit/halte-runtime";
import { haversineMeters } from "@/lib/transit/buggy-route-utils";
import { sendWebPush } from "@/lib/push/web-push";
import { isBuggyRealtimeReachable } from "@/lib/buggy/connection-status";
import type { Buggy, HaltePoint } from "@/types/buggy";

const USER_HALTE_RADIUS_METERS = 500;
const ALERT_COOLDOWN_MS = 60_000;
const DEFAULT_ALERT_RADIUS_METERS = 150;

type NotificationSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_lat: number | null;
  user_lng: number | null;
  nearby_radius_meters: number | null;
  last_notified_key: string | null;
  last_notified_at: string | null;
};

type NearbyPushMatch = {
  buggy: Buggy;
  halte: HaltePoint;
  distanceMeters: number;
  alertKey: string;
};

function isExpiredPushSubscriptionError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    (error.statusCode === 404 || error.statusCode === 410)
  );
}

function isInCooldown(row: NotificationSubscriptionRow, alertKey: string) {
  if (row.last_notified_key !== alertKey || !row.last_notified_at) {
    return false;
  }

  const lastNotifiedAt = new Date(row.last_notified_at).getTime();
  return (
    Number.isFinite(lastNotifiedAt) &&
    Date.now() - lastNotifiedAt < ALERT_COOLDOWN_MS
  );
}

function findNearestHalteToUser(
  row: NotificationSubscriptionRow,
  haltes: HaltePoint[],
) {
  if (typeof row.user_lat !== "number" || typeof row.user_lng !== "number") {
    return null;
  }

  let nearestHalte: HaltePoint | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  const userPosition = { lat: row.user_lat, lng: row.user_lng };

  for (const halte of haltes) {
    const distance = haversineMeters(userPosition, halte);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestHalte = halte;
    }
  }

  if (!nearestHalte || nearestDistance > USER_HALTE_RADIUS_METERS) {
    return null;
  }

  return nearestHalte;
}

function findNearbyBuggyForSubscription(
  row: NotificationSubscriptionRow,
  buggies: Buggy[],
  haltes: HaltePoint[],
): NearbyPushMatch | null {
  const halte = findNearestHalteToUser(row, haltes);
  if (!halte) return null;

  const radius = Math.max(
    50,
    Math.min(1000, row.nearby_radius_meters ?? DEFAULT_ALERT_RADIUS_METERS),
  );

  for (const buggy of buggies) {
    if (!isBuggyRealtimeReachable(buggy)) continue;

    const distanceMeters = haversineMeters(buggy.position, halte);
    if (distanceMeters > radius) continue;

    return {
      buggy,
      halte,
      distanceMeters: Math.round(distanceMeters),
      alertKey: `${buggy.id}::${halte.id}`,
    };
  }

  return null;
}

async function fetchActiveBuggies() {
  await bootstrapFromDatabase();
  const snapshot = getBuggyLiveSnapshot();
  const latest = await mergeLatestBuggyTelemetry(snapshot.buggies);
  return latest.buggies.filter(isBuggyRealtimeReachable);
}

async function updateNotificationState(
  supabase: SupabaseClient,
  row: NotificationSubscriptionRow,
  match: NearbyPushMatch,
) {
  await supabase
    .from("notification_subscriptions")
    .update({
      last_notified_key: match.alertKey,
      last_notified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);
}

export async function processNearbyPushAlerts() {
  const supabase = createAdminClient();
  if (!supabase) {
    throw new Error(
      "Supabase admin client belum lengkap. Set NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  const [{ data, error }, buggies] = await Promise.all([
    supabase
      .from("notification_subscriptions")
      .select(
        "id, endpoint, p256dh, auth, user_lat, user_lng, nearby_radius_meters, last_notified_key, last_notified_at",
      )
      .not("user_lat", "is", null)
      .not("user_lng", "is", null),
    fetchActiveBuggies(),
  ]);

  if (error) {
    throw new Error(`Gagal membaca notification_subscriptions: ${error.message}`);
  }

  const rows = (data ?? []) as NotificationSubscriptionRow[];
  const haltes = getHalteLocations();
  let checked = 0;
  let matched = 0;
  let sent = 0;
  let removed = 0;
  let skippedCooldown = 0;

  for (const row of rows) {
    checked += 1;
    const match = findNearbyBuggyForSubscription(row, buggies, haltes);
    if (!match) continue;
    matched += 1;

    if (isInCooldown(row, match.alertKey)) {
      skippedCooldown += 1;
      continue;
    }

    try {
      await sendWebPush(
        {
          endpoint: row.endpoint,
          keys: {
            p256dh: row.p256dh,
            auth: row.auth,
          },
        },
        {
          title: `${match.buggy.name} mendekati halte`,
          body: `${match.halte.name} · ${match.distanceMeters} m lagi`,
          tag: `nearby-${match.alertKey}`,
          url: "/",
          data: {
            buggyId: match.buggy.id,
            halteId: match.halte.id,
          },
        },
      );
      await updateNotificationState(supabase, row, match);
      sent += 1;
    } catch (err) {
      if (isExpiredPushSubscriptionError(err)) {
        await supabase
          .from("notification_subscriptions")
          .delete()
          .eq("id", row.id);
        removed += 1;
        continue;
      }
      console.warn("[push] Gagal mengirim Web Push:", err);
    }
  }

  return {
    checked,
    matched,
    sent,
    removed,
    skippedCooldown,
    activeBuggies: buggies.length,
  };
}
