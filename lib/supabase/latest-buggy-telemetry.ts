/**
 * Latest telemetry merger.
 *
 * Overlays durable `latest_buggy_telemetry` rows onto the live-store snapshot so
 * the dashboard can recover last known position/status after server restarts.
 */
import {
  createAdminClient,
  getLatestBuggyTelemetryTableName,
} from "@/lib/supabase/server";
import { findNearestPathIndex } from "@/lib/transit/buggy-route-utils";
import { getHalteLocations } from "@/lib/transit/halte-runtime";
import { resolveBuggyConnectionStatus } from "@/lib/buggy/connection-status";
import type { Buggy } from "@/types/buggy";

type LatestBuggyTelemetryRow = {
  devices_id?: string | null;
  buggy_id: string | null;
  buggy_numeric_id: number | null;
  lat: number | null;
  lng: number | null;
  speed_kmh: number | null;
  passengers?: number | null;
  capacity?: number | null;
  recorded_at: string | null;
  received_at?: string | null;
  updated_at?: string | null;
};

const ACTIVE_HISTORY_WINDOW_MS = 10_000;

function resolveLastSeenAt(row: LatestBuggyTelemetryRow): string | null {
  return row.received_at ?? row.updated_at ?? row.recorded_at;
}

function toTimeLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";

  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function resolveNearestHalteIndex(lat: number, lng: number): number {
  const haltes = getHalteLocations();
  if (haltes.length === 0) return 0;

  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < haltes.length; i += 1) {
    const halte = haltes[i];
    const distance = Math.hypot(halte.lat - lat, halte.lng - lng);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }

  return bestIndex;
}

function resolveCrowdLevel(passengers: number, capacity: number): Buggy["crowdLevel"] {
  const ratio = capacity > 0 ? passengers / capacity : 0;
  if (ratio >= 0.85) return "PENUH";
  if (ratio >= 0.55) return "HAMPIR_PENUH";
  return "LONGGAR";
}

function getTelemetryTimeMs(row: LatestBuggyTelemetryRow): number {
  const value = resolveLastSeenAt(row) ?? row.recorded_at;
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function resolveTelemetryKeys(row: LatestBuggyTelemetryRow): string[] {
  const keys: string[] = [];
  if (typeof row.buggy_id === "string" && row.buggy_id.length > 0) {
    keys.push(`id:${row.buggy_id}`);
  }
  if (typeof row.buggy_numeric_id === "number") {
    keys.push(`numeric:${row.buggy_numeric_id}`);
  }
  return keys;
}

function resolveBuggyKeys(buggy: Buggy): string[] {
  const keys = [`id:${buggy.id}`];
  if (typeof buggy.numericId === "number") keys.push(`numeric:${buggy.numericId}`);
  return keys;
}

export async function mergeLatestBuggyTelemetry(
  buggies: Buggy[],
): Promise<{ buggies: Buggy[]; updatedAt: number | null; mergedCount: number }> {
  const supabase = createAdminClient();
  if (!supabase || buggies.length === 0) {
    return { buggies, updatedAt: null, mergedCount: 0 };
  }

  const { data, error } = await supabase
    .from(getLatestBuggyTelemetryTableName())
    .select("*")
    .order("recorded_at", { ascending: false });

  if (error) {
    console.warn("[latest-buggy-telemetry] Gagal fetch latest telemetry:", error.message);
    return { buggies, updatedAt: null, mergedCount: 0 };
  }

  const latestByKey = new Map<string, LatestBuggyTelemetryRow>();
  for (const row of (data ?? []) as LatestBuggyTelemetryRow[]) {
    for (const key of resolveTelemetryKeys(row)) {
      const existing = latestByKey.get(key);
      if (!existing || getTelemetryTimeMs(row) > getTelemetryTimeMs(existing)) {
        latestByKey.set(key, row);
      }
    }
  }

  let mergedCount = 0;
  let newestUpdatedAt: number | null = null;
  const now = Date.now();

  const merged = buggies.map((buggy) => {
    const row =
      resolveBuggyKeys(buggy)
        .map((key) => latestByKey.get(key))
        .filter((item): item is LatestBuggyTelemetryRow => Boolean(item))
        .sort((a, b) => getTelemetryTimeMs(b) - getTelemetryTimeMs(a))[0] ??
      null;

    const lastSeenAt = row ? resolveLastSeenAt(row) : null;
    if (
      !row ||
      typeof row.lat !== "number" ||
      typeof row.lng !== "number" ||
      !row.recorded_at ||
      !lastSeenAt
    ) {
      return buggy;
    }

    const lastSeenAtMs = new Date(lastSeenAt).getTime();
    if (Number.isFinite(lastSeenAtMs)) {
      newestUpdatedAt = Math.max(newestUpdatedAt ?? 0, lastSeenAtMs);
    }

    mergedCount += 1;

    // Capacity is fleet master data edited from the admin panel. History rows
    // may contain stale device payloads, so they must not override DB changes.
    const capacity = Math.max(1, buggy.capacity);
    const passengers =
      typeof row.passengers === "number"
        ? Math.max(0, Math.min(row.passengers, capacity))
        : buggy.passengers;
    const lastSeenSecondsAgo = Number.isFinite(lastSeenAtMs)
      ? Math.max(0, Math.floor((now - lastSeenAtMs) / 1000))
      : undefined;
    const connectionStatus =
      resolveBuggyConnectionStatus(lastSeenSecondsAgo);

    return {
      ...buggy,
      isActive:
        Number.isFinite(lastSeenAtMs) &&
        now - lastSeenAtMs <= ACTIVE_HISTORY_WINDOW_MS,
      connectionStatus,
      lastSeenAt,
      lastSeenSecondsAgo,
      speedKmh:
        typeof row.speed_kmh === "number"
          ? Math.max(0, row.speed_kmh)
          : buggy.speedKmh,
      passengers,
      capacity,
      crowdLevel: resolveCrowdLevel(passengers, capacity),
      tag: "GPS Nyata",
      updatedAt: toTimeLabel(row.recorded_at),
      currentStopIndex: resolveNearestHalteIndex(row.lat, row.lng),
      pathCursor: findNearestPathIndex(row.lat, row.lng),
      position: {
        lat: row.lat,
        lng: row.lng,
      },
    };
  });

  return { buggies: merged, updatedAt: newestUpdatedAt, mergedCount };
}
