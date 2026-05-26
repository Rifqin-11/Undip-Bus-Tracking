import { createAdminClient, getBuggyHistoryTableName } from "@/lib/supabase/server";
import { findNearestPathIndex } from "@/lib/transit/buggy-route-utils";
import { getHalteLocations } from "@/lib/transit/halte-runtime";
import { sanitizeGpsPoints } from "@/lib/buggy/gps-quality";
import type { Buggy } from "@/types/buggy";

type BuggyHistoryRow = {
  buggy_id: string | null;
  buggy_numeric_id: number | null;
  lat: number | null;
  lng: number | null;
  speed_kmh: number | null;
  passengers?: number | null;
  capacity?: number | null;
  recorded_at: string | null;
};

const LATEST_HISTORY_LOOKBACK_LIMIT = 100;
const ACTIVE_HISTORY_WINDOW_MS = 30_000;

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

function resolveHistoryKey(row: BuggyHistoryRow): string | null {
  if (typeof row.buggy_numeric_id === "number") {
    return `numeric:${row.buggy_numeric_id}`;
  }
  if (typeof row.buggy_id === "string" && row.buggy_id.length > 0) {
    return `id:${row.buggy_id}`;
  }
  return null;
}

function resolveBuggyKeys(buggy: Buggy): string[] {
  const keys = [`id:${buggy.id}`];
  if (typeof buggy.numericId === "number") keys.push(`numeric:${buggy.numericId}`);
  return keys;
}

export async function mergeLatestBuggyTelemetryFromHistory(
  buggies: Buggy[],
): Promise<{ buggies: Buggy[]; updatedAt: number | null; mergedCount: number }> {
  const supabase = createAdminClient();
  if (!supabase || buggies.length === 0) {
    return { buggies, updatedAt: null, mergedCount: 0 };
  }

  const { data, error } = await supabase
    .from(getBuggyHistoryTableName())
    .select("*")
    .order("recorded_at", { ascending: false })
    .limit(LATEST_HISTORY_LOOKBACK_LIMIT);

  if (error) {
    console.warn("[latest-buggy-telemetry] Gagal fetch history terbaru:", error.message);
    return { buggies, updatedAt: null, mergedCount: 0 };
  }

  const latestByKey = new Map<string, BuggyHistoryRow>();
  const rowsByKey = new Map<string, BuggyHistoryRow[]>();
  for (const row of (data ?? []) as BuggyHistoryRow[]) {
    const key = resolveHistoryKey(row);
    if (!key) continue;
    rowsByKey.set(key, [...(rowsByKey.get(key) ?? []), row]);
  }

  for (const [key, rows] of rowsByKey.entries()) {
    const orderedRows = rows
      .filter(
        (row) =>
          typeof row.lat === "number" &&
          typeof row.lng === "number" &&
          typeof row.recorded_at === "string",
      )
      .sort(
        (a, b) =>
          new Date(a.recorded_at ?? 0).getTime() -
          new Date(b.recorded_at ?? 0).getTime(),
      );

    const sanitizedRows = sanitizeGpsPoints(
      orderedRows.map((row) => ({
        ...row,
        lat: row.lat as number,
        lng: row.lng as number,
        recordedAt: row.recorded_at as string,
      })),
    );
    const latest = sanitizedRows[sanitizedRows.length - 1];

    if (latest) latestByKey.set(key, latest);
  }

  let mergedCount = 0;
  let newestUpdatedAt: number | null = null;
  const now = Date.now();

  const merged = buggies.map((buggy) => {
    const row = resolveBuggyKeys(buggy)
      .map((key) => latestByKey.get(key))
      .find((item): item is BuggyHistoryRow => Boolean(item));

    if (!row || typeof row.lat !== "number" || typeof row.lng !== "number" || !row.recorded_at) {
      return buggy;
    }

    const recordedAtMs = new Date(row.recorded_at).getTime();
    if (Number.isFinite(recordedAtMs)) {
      newestUpdatedAt = Math.max(newestUpdatedAt ?? 0, recordedAtMs);
    }

    mergedCount += 1;

    // Capacity is fleet master data edited from the admin panel. History rows
    // may contain stale device payloads, so they must not override DB changes.
    const capacity = Math.max(1, buggy.capacity);
    const passengers =
      typeof row.passengers === "number"
        ? Math.max(0, Math.min(row.passengers, capacity))
        : buggy.passengers;

    return {
      ...buggy,
      isActive: Number.isFinite(recordedAtMs) && now - recordedAtMs <= ACTIVE_HISTORY_WINDOW_MS,
      speedKmh: typeof row.speed_kmh === "number" ? Math.max(0, row.speed_kmh) : buggy.speedKmh,
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
